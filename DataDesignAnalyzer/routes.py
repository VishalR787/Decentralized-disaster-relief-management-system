from flask import render_template, request, jsonify, redirect, url_for, send_from_directory, flash
from app import app, db
from models import User, HelpRequest, VolunteerSkill, Match, ResourceForecast
import ai_models
import logging
import json
import os
import base64
from datetime import datetime, timedelta

# Initialize AI models
ai_status = ai_models.initialize_models()
logging.info(f"AI models initialization status: {ai_status}")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/service-worker.js')
def service_worker():
    return send_from_directory('static/js', 'service-worker.js')

@app.route('/manifest.json')
def manifest():
    return send_from_directory('static', 'manifest.json')

@app.route('/victim')
def victim_page():
    return render_template('victim.html')

@app.route('/volunteer')
def volunteer_page():
    return render_template('volunteer.html')

@app.route('/dashboard')
def dashboard():
    # Fetch overall statistics
    victim_count = User.query.filter_by(role='victim').count()
    volunteer_count = User.query.filter_by(role='volunteer').count()
    pending_requests = HelpRequest.query.filter_by(status='pending').count()
    matched_requests = HelpRequest.query.filter_by(status='matched').count()
    
    # Get recent help requests for the map
    recent_requests = HelpRequest.query.order_by(HelpRequest.created_at.desc()).limit(50).all()
    
    # Get volunteer locations for the map
    volunteers = User.query.filter_by(role='volunteer').all()
    
    return render_template(
        'dashboard.html',
        victim_count=victim_count,
        volunteer_count=volunteer_count,
        pending_requests=pending_requests,
        matched_requests=matched_requests,
        recent_requests=recent_requests,
        volunteers=volunteers
    )

@app.route('/api/register', methods=['POST'])
def register_user():
    try:
        data = request.form
        
        # Create new user
        user = User(
            name=data['name'],
            contact=data['contact'],
            location_lat=float(data.get('location_lat', 0)) if data.get('location_lat') else None,
            location_lng=float(data.get('location_lng', 0)) if data.get('location_lng') else None,
            location_name=data.get('location_name', ''),
            role=data['role']
        )
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': f'User registered as {data["role"]}',
            'user_id': user.id
        })
        
    except Exception as e:
        logging.error(f"Error registering user: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to register: {str(e)}'
        }), 500

@app.route('/api/help-request', methods=['POST'])
def submit_help_request():
    try:
        data = request.form
        image_data = request.files.get('image')
        image_binary = None
        
        # Process image if provided
        if image_data:
            image_binary = image_data.read()
            
        # Get user
        user_id = int(data['user_id'])
        user = User.query.get(user_id)
        
        if not user or user.role != 'victim':
            return jsonify({
                'status': 'error',
                'message': 'Invalid user or user is not registered as a victim'
            }), 400
        
        # Create help request
        help_request = HelpRequest(
            victim_id=user_id,
            help_type=data['help_type'],
            description=data.get('description', ''),
            people_affected=int(data.get('people_affected', 1)),
            weather_condition=data.get('weather_condition', ''),
            location_lat=float(data.get('location_lat', 0)) if data.get('location_lat') else user.location_lat,
            location_lng=float(data.get('location_lng', 0)) if data.get('location_lng') else user.location_lng
        )
        
        # Process image if available
        if image_binary:
            help_request.image_data = image_binary
            # Analyze damage level
            damage_level = ai_models.analyze_damage_from_image(image_binary)
            help_request.damage_level = damage_level
            
        # Classify urgency
        urgency = ai_models.classify_urgency(
            help_request.description,
            help_request.people_affected,
            help_request.help_type
        )
        help_request.urgency_level = urgency
        
        db.session.add(help_request)
        db.session.commit()
        
        # Find matching volunteers
        matching_result = find_matching_volunteers(help_request)
        
        return jsonify({
            'status': 'success',
            'message': 'Help request submitted successfully',
            'request_id': help_request.id,
            'urgency_level': help_request.urgency_level,
            'damage_level': help_request.damage_level,
            'matches': len(matching_result['matches']),
            'match_status': matching_result['status']
        })
        
    except Exception as e:
        logging.error(f"Error submitting help request: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to submit help request: {str(e)}'
        }), 500

@app.route('/api/volunteer-skills', methods=['POST'])
def submit_volunteer_skills():
    try:
        data = request.form
        
        # Get user
        user_id = int(data['user_id'])
        user = User.query.get(user_id)
        
        if not user or user.role != 'volunteer':
            return jsonify({
                'status': 'error',
                'message': 'Invalid user or user is not registered as a volunteer'
            }), 400
        
        # Process skills (can be multiple)
        skills = data.getlist('skills[]')
        resources = data.getlist('resources[]')
        quantities = data.getlist('quantities[]')
        
        # Clear existing skills
        VolunteerSkill.query.filter_by(volunteer_id=user_id).delete()
        
        # Add new skills
        for i in range(len(skills)):
            skill = VolunteerSkill(
                volunteer_id=user_id,
                skill_type=skills[i],
                resource=resources[i] if i < len(resources) else None,
                resource_quantity=int(quantities[i]) if i < len(quantities) and quantities[i].isdigit() else None
            )
            db.session.add(skill)
        
        db.session.commit()
        
        # Find pending help requests that match this volunteer
        matching_requests = find_matching_requests(user)
        
        return jsonify({
            'status': 'success',
            'message': 'Volunteer skills updated successfully',
            'skills_count': len(skills),
            'matching_requests': len(matching_requests['matches'])
        })
        
    except Exception as e:
        logging.error(f"Error submitting volunteer skills: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to update volunteer skills: {str(e)}'
        }), 500

def find_matching_volunteers(help_request):
    """Find volunteers that match a help request"""
    try:
        # Get volunteers with relevant skills
        skill_type = help_request.help_type
        potential_volunteers = User.query.filter_by(role='volunteer').all()
        
        # Use AI model to match volunteers
        matches = ai_models.match_volunteers(help_request, potential_volunteers)
        
        # Create match records for top 5 matches
        top_matches = matches[:5]
        created_matches = []
        
        for match in top_matches:
            volunteer = match['volunteer']
            match_record = Match(
                help_request_id=help_request.id,
                victim_id=help_request.victim_id,
                volunteer_id=volunteer.id,
                match_score=match['score']
            )
            db.session.add(match_record)
            created_matches.append({
                'volunteer_id': volunteer.id,
                'volunteer_name': volunteer.name,
                'score': match['score'],
                'distance': match['distance']
            })
        
        # Update help request status if matches found
        if created_matches:
            help_request.status = 'matched'
            
        db.session.commit()
        
        return {
            'status': 'success',
            'matches': created_matches
        }
    
    except Exception as e:
        logging.error(f"Error finding matching volunteers: {str(e)}")
        db.session.rollback()
        return {
            'status': 'error',
            'message': str(e),
            'matches': []
        }

def find_matching_requests(volunteer):
    """Find help requests that match a volunteer"""
    try:
        # Get pending help requests
        pending_requests = HelpRequest.query.filter_by(status='pending').all()
        
        # Match against each request
        matches = []
        for request in pending_requests:
            request_matches = ai_models.match_volunteers(request, [volunteer])
            if request_matches:
                match = request_matches[0]
                matches.append({
                    'request_id': request.id,
                    'help_type': request.help_type,
                    'victim_id': request.victim_id,
                    'urgency': request.urgency_level,
                    'score': match['score'],
                    'distance': match['distance']
                })
                
                # Create match record
                match_record = Match(
                    help_request_id=request.id,
                    victim_id=request.victim_id,
                    volunteer_id=volunteer.id,
                    match_score=match['score']
                )
                db.session.add(match_record)
        
        db.session.commit()
        
        return {
            'status': 'success',
            'matches': matches
        }
    
    except Exception as e:
        logging.error(f"Error finding matching requests: {str(e)}")
        db.session.rollback()
        return {
            'status': 'error',
            'message': str(e),
            'matches': []
        }

@app.route('/resource-forecast')
def resource_forecast_page():
    return render_template('resource_forecast.html')

@app.route('/api/resource-forecast')
def get_resource_forecast():
    try:
        # Get area coordinates
        lat = float(request.args.get('lat', 0))
        lng = float(request.args.get('lng', 0))
        
        # Get user input parameters
        people_count = request.args.get('people_count')
        condition = request.args.get('condition')
        severity = request.args.get('severity')
        
        # Convert people_count to integer if provided
        if people_count:
            people_count = int(people_count)
        
        # Get recent requests in this area (simple radius search)
        recent_requests = HelpRequest.query.filter(
            HelpRequest.created_at >= (datetime.utcnow() - timedelta(days=3))
        ).all()
        
        # Filter requests by proximity
        radius = 25  # km
        nearby_requests = []
        for req in recent_requests:
            if req.location_lat and req.location_lng:
                dist = ai_models.calculate_distance(
                    lat, lng, req.location_lat, req.location_lng
                )
                if dist <= radius:
                    nearby_requests.append(req)
        
        # Generate forecast with user input parameters
        forecast = ai_models.forecast_resource_needs(
            lat, lng, nearby_requests, 
            people_count=people_count, 
            condition=condition, 
            severity=severity
        )
        
        # Store forecast in database
        for resource_type, prediction in forecast.items():
            forecast_record = ResourceForecast(
                location_lat=lat,
                location_lng=lng,
                resource_type=resource_type,
                predicted_demand=prediction['predicted_demand'],
                prediction_confidence=prediction['confidence']
            )
            db.session.add(forecast_record)
        
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'forecast': forecast
        })
        
    except Exception as e:
        logging.error(f"Error generating resource forecast: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to generate forecast: {str(e)}'
        }), 500

@app.route('/api/matches', methods=['GET'])
def get_matches():
    try:
        user_id = request.args.get('user_id')
        role = request.args.get('role')
        
        if not user_id or not role:
            return jsonify({
                'status': 'error',
                'message': 'Missing user_id or role parameter'
            }), 400
            
        user_id = int(user_id)
        
        if role == 'victim':
            # Get matches for this victim
            matches = Match.query.filter_by(victim_id=user_id).all()
            result = []
            
            for match in matches:
                volunteer = User.query.get(match.volunteer_id)
                help_request = HelpRequest.query.get(match.help_request_id)
                
                result.append({
                    'match_id': match.id,
                    'volunteer_name': volunteer.name,
                    'volunteer_contact': volunteer.contact,
                    'help_type': help_request.help_type,
                    'status': match.status,
                    'created_at': match.created_at.strftime('%Y-%m-%d %H:%M:%S')
                })
                
        elif role == 'volunteer':
            # Get matches for this volunteer
            matches = Match.query.filter_by(volunteer_id=user_id).all()
            result = []
            
            for match in matches:
                victim = User.query.get(match.victim_id)
                help_request = HelpRequest.query.get(match.help_request_id)
                
                result.append({
                    'match_id': match.id,
                    'victim_name': victim.name,
                    'victim_contact': victim.contact,
                    'help_type': help_request.help_type,
                    'urgency': help_request.urgency_level,
                    'people_affected': help_request.people_affected,
                    'status': match.status,
                    'created_at': match.created_at.strftime('%Y-%m-%d %H:%M:%S')
                })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Invalid role parameter'
            }), 400
            
        return jsonify({
            'status': 'success',
            'matches': result
        })
        
    except Exception as e:
        logging.error(f"Error retrieving matches: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to retrieve matches: {str(e)}'
        }), 500

@app.route('/api/match/update', methods=['POST'])
def update_match():
    try:
        data = request.form
        match_id = int(data['match_id'])
        new_status = data['status']
        
        # Validate status
        valid_statuses = ['pending', 'accepted', 'completed', 'cancelled']
        if new_status not in valid_statuses:
            return jsonify({
                'status': 'error',
                'message': f'Invalid status: {new_status}'
            }), 400
            
        # Update match
        match = Match.query.get(match_id)
        if not match:
            return jsonify({
                'status': 'error',
                'message': f'Match with ID {match_id} not found'
            }), 404
            
        match.status = new_status
        match.updated_at = datetime.utcnow()
        
        # If match is completed, update help request status
        if new_status == 'completed':
            help_request = HelpRequest.query.get(match.help_request_id)
            help_request.status = 'resolved'
            
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': f'Match status updated to {new_status}'
        })
        
    except Exception as e:
        logging.error(f"Error updating match: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to update match: {str(e)}'
        }), 500

@app.route('/api/status', methods=['GET'])
def get_system_status():
    """Get overall system status"""
    try:
        # Count users by role
        victim_count = User.query.filter_by(role='victim').count()
        volunteer_count = User.query.filter_by(role='volunteer').count()
        
        # Count help requests by status
        pending_requests = HelpRequest.query.filter_by(status='pending').count()
        matched_requests = HelpRequest.query.filter_by(status='matched').count()
        resolved_requests = HelpRequest.query.filter_by(status='resolved').count()
        
        # Count help requests by type
        help_types = {}
        for help_type in ['food', 'shelter', 'medical', 'evacuation', 'rescue', 'supplies', 'other']:
            count = HelpRequest.query.filter_by(help_type=help_type).count()
            if count > 0:
                help_types[help_type] = count
        
        # AI models status
        ai_status = {
            'urgency_classifier': True,
            'damage_analyzer': True,
            'volunteer_matcher': True
        }
        
        return jsonify({
            'status': 'success',
            'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
            'users': {
                'victims': victim_count,
                'volunteers': volunteer_count
            },
            'requests': {
                'pending': pending_requests,
                'matched': matched_requests,
                'resolved': resolved_requests,
                'by_type': help_types
            },
            'ai_status': ai_status
        })
        
    except Exception as e:
        logging.error(f"Error getting system status: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to get system status: {str(e)}'
        }), 500
