import os
import numpy as np
import pickle
import logging
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from PIL import Image
import io
import base64
from math import radians, cos, sin, asin, sqrt

# Setup logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Constants
URGENCY_LEVELS = ['low', 'medium', 'high']
DAMAGE_LEVELS = ['minimal', 'moderate', 'severe']
HELP_TYPES = ['food', 'shelter', 'medical', 'evacuation', 'rescue', 'supplies', 'other']

# Path for storing/loading models
MODEL_PATH = os.path.dirname(os.path.abspath(__file__))

# Pre-trained models (simple versions for demonstration)
urgency_classifier = None
damage_analyzer = None
volunteer_matcher = None
tfidf_vectorizer = None

def initialize_models():
    """Initialize AI models on startup"""
    global urgency_classifier, damage_analyzer, volunteer_matcher, tfidf_vectorizer
    
    try:
        # Create simple models if they don't exist yet
        logger.info("Initializing AI models...")
        
        # 1. Urgency Classification Model
        # Creating a simple RandomForest model for urgency classification
        tfidf_vectorizer = TfidfVectorizer(max_features=100)
        urgency_classifier = RandomForestClassifier(n_estimators=10)
        
        # 2. Damage Analysis Model - simple classifier
        damage_analyzer = RandomForestClassifier(n_estimators=10)
        
        # 3. Volunteer Matching Model
        volunteer_matcher = RandomForestClassifier(n_estimators=10)
        
        logger.info("AI models initialized successfully")
        
    except Exception as e:
        logger.error(f"Error initializing AI models: {str(e)}")
        
    return {
        'urgency_classifier': urgency_classifier is not None,
        'damage_analyzer': damage_analyzer is not None,
        'volunteer_matcher': volunteer_matcher is not None
    }

def classify_urgency(description, people_affected, help_type):
    """
    Classify the urgency of a help request
    Returns: 'low', 'medium', or 'high'
    """
    try:
        # Simple rule-based classification
        if people_affected >= 10 or help_type == 'medical' or 'urgent' in description.lower():
            return 'high'
        elif people_affected >= 3 or help_type in ['food', 'shelter'] or 'soon' in description.lower():
            return 'medium'
        else:
            return 'low'
    except Exception as e:
        logger.error(f"Error in urgency classification: {str(e)}")
        return 'medium'  # Default to medium urgency if error

def analyze_damage_from_image(image_data):
    """
    Analyze damage level from uploaded image
    Returns: 'minimal', 'moderate', or 'severe'
    """
    try:
        if not image_data:
            return 'unknown'
            
        # Process image data (assuming base64 format)
        if isinstance(image_data, str) and image_data.startswith('data:image'):
            # Extract the actual base64 data
            image_data = image_data.split(',')[1]
            
        if isinstance(image_data, str):
            image_data = base64.b64decode(image_data)
            
        # Convert to PIL Image for processing
        image = Image.open(io.BytesIO(image_data))
        
        # Resize for consistent processing
        image = image.resize((128, 128))
        
        # Simple grayscale analysis - higher pixel variance often correlates with more damage
        image_array = np.array(image.convert('L'))
        variance = np.var(image_array)
        
        # Simple threshold-based classification
        if variance > 2500:
            return 'severe'
        elif variance > 1500:
            return 'moderate'
        else:
            return 'minimal'
    except Exception as e:
        logger.error(f"Error in damage analysis: {str(e)}")
        return 'unknown'

def match_volunteers(help_request, available_volunteers):
    """
    Match volunteers to help requests based on:
    - Distance to victim
    - Skills matching help type
    - Availability
    
    Returns: List of volunteer matches with scores
    """
    matches = []
    
    try:
        # Ensure we have location data for the help request
        if not help_request.location_lat or not help_request.location_lng:
            return matches
            
        for volunteer in available_volunteers:
            # Skip volunteers without location data
            if not volunteer.location_lat or not volunteer.location_lng:
                continue
                
            # Calculate distance (simple Euclidean distance for demo)
            distance = calculate_distance(
                help_request.location_lat, help_request.location_lng,
                volunteer.location_lat, volunteer.location_lng
            )
            
            # Check if volunteer has relevant skills
            skill_match = 0
            for skill in volunteer.skills:
                # If skill type matches help type directly
                if skill.skill_type.lower() == help_request.help_type.lower():
                    skill_match = 1.0
                    break
                # Partial matches
                elif help_request.help_type == 'medical' and skill.skill_type in ['doctor', 'nurse', 'first_aid']:
                    skill_match = 0.9
                    break
                elif help_request.help_type == 'evacuation' and skill.skill_type in ['driving', 'rescue']:
                    skill_match = 0.8
                    break
                elif help_request.help_type == 'food' and skill.skill_type in ['cooking', 'food_distribution']:
                    skill_match = 0.9
                    break
            
            # Skip if no skill match at all
            if skill_match == 0:
                continue
                
            # Calculate match score (weighted combination of factors)
            # Distance is inversely weighted - closer is better
            max_distance = 50.0  # km
            distance_factor = max(0, 1 - (distance / max_distance))
            
            # Urgency affects the importance of distance
            urgency_weight = 0.5
            if help_request.urgency_level == 'high':
                urgency_weight = 0.8
            elif help_request.urgency_level == 'low':
                urgency_weight = 0.3
                
            # Calculate final score
            match_score = (distance_factor * urgency_weight) + (skill_match * (1 - urgency_weight))
            
            # Only include reasonable matches
            if match_score > 0.3:
                matches.append({
                    'volunteer': volunteer,
                    'score': match_score,
                    'distance': distance
                })
        
        # Sort by score (highest first)
        matches.sort(key=lambda x: x['score'], reverse=True)
        
    except Exception as e:
        logger.error(f"Error in volunteer matching: {str(e)}")
        
    return matches

def forecast_resource_needs(area_lat, area_lng, recent_requests, people_count=None, condition=None, severity=None):
    """
    Forecast future resource needs in an area based on:
    - User input: number of people affected, condition type, and severity
    - Recent request patterns
    - Location data
    
    Parameters:
    - area_lat, area_lng: Location coordinates
    - recent_requests: Historical request data
    - people_count: Number of people affected (user input)
    - condition: Type of condition/disaster (user input)
    - severity: Severity level of the situation (user input)
    
    Returns: Dictionary of predicted resource needs with specific quantities
    """
    forecast = {}
    
    try:
        # Initialize forecast for all resource types
        for resource_type in HELP_TYPES:
            forecast[resource_type] = {
                'predicted_demand': 0,
                'confidence': 0.5,
                'quantity': {
                    'units': 0,
                    'unit_type': 'items'
                }
            }
        
        # If user input is provided, use it for prediction
        if people_count is not None:
            # Convert to integer if it's a string
            if isinstance(people_count, str):
                people_count = int(people_count)
                
            # Adjust confidence based on user input
            confidence = 0.85  # Higher confidence with direct user input
            
            # Adjust resource needs based on condition and severity
            condition_factor = 1.0
            if condition:
                condition = condition.lower()
                if 'flood' in condition:
                    # Floods increase need for shelter, water purification, evacuation
                    condition_factor = 1.3
                elif 'fire' in condition:
                    # Fires increase need for medical, shelter, evacuation
                    condition_factor = 1.4
                elif 'earthquake' in condition:
                    # Earthquakes increase need for rescue, medical, shelter
                    condition_factor = 1.5
                elif 'storm' in condition or 'hurricane' in condition:
                    # Storms increase need for shelter, food, water
                    condition_factor = 1.2
            
            # Adjust based on severity
            severity_factor = 1.0
            if severity:
                severity = severity.lower()
                if severity in ['high', 'severe', 'extreme']:
                    severity_factor = 1.5
                elif severity in ['medium', 'moderate']:
                    severity_factor = 1.2
                # 'low' or 'minimal' severity uses default factor
            
            # Calculate adjusted people count
            adjusted_people = int(people_count * condition_factor * severity_factor)
            
            # Generate resource-specific forecasts
            for resource_type in HELP_TYPES:
                # Calculate specific quantities based on resource type and adjusted people count
                quantity = calculate_resource_quantity(resource_type, adjusted_people, condition, severity)
                
                forecast[resource_type] = {
                    'predicted_demand': adjusted_people,
                    'confidence': confidence,
                    'quantity': quantity
                }
        
        # If no user input, use historical data
        else:
            # Group requests by help type
            help_types = {}
            for req in recent_requests:
                help_type = req.help_type
                if help_type not in help_types:
                    help_types[help_type] = []
                help_types[help_type].append(req)
            
            # For each help type, predict future demand
            for help_type, requests in help_types.items():
                # Simple formula: average people affected * 1.5 to project future needs
                total_affected = sum(req.people_affected for req in requests)
                avg_affected = total_affected / len(requests) if requests else 0
                
                # Adjust based on urgency levels
                urgency_factor = 1.0
                high_urgency_count = sum(1 for req in requests if req.urgency_level == 'high')
                urgency_ratio = high_urgency_count / len(requests) if requests else 0
                urgency_factor = 1.0 + (urgency_ratio * 0.5)  # Up to 50% increase for areas with high urgency
                
                # Predict demand (number of people needing this resource)
                predicted_demand = int(avg_affected * urgency_factor * 1.5)
                
                # Calculate confidence (higher for more data points)
                confidence = min(0.95, 0.5 + (len(requests) / 20))
                
                # Calculate specific quantities based on resource type
                quantity = calculate_resource_quantity(help_type, predicted_demand)
                
                forecast[help_type] = {
                    'predicted_demand': predicted_demand,
                    'confidence': confidence,
                    'quantity': quantity
                }
    
    except Exception as e:
        logger.error(f"Error in resource forecasting: {str(e)}")
    
    return forecast

def calculate_resource_quantity(resource_type, people_count, condition=None, severity=None):
    """
    Calculate specific quantities needed for each resource type
    based on the number of people affected, condition, and severity
    """
    # Base multipliers for different resource types
    base_multipliers = {
        'food': 3,       # 3 meals per person per day
        'water': 3,      # 3 liters per person per day
        'shelter': 0.25, # 1 shelter unit per 4 people
        'medical': 0.5,  # 1 medical kit per 2 people
        'evacuation': 0.2, # 1 vehicle per 5 people
        'rescue': 0.33,  # 1 rescue personnel per 3 people
        'supplies': 1,   # 1 supply kit per person
        'other': 1       # 1 generic item per person
    }
    
    # Adjust multipliers based on severity
    severity_adjustment = 1.0
    if severity:
        severity = severity.lower()
        if severity in ['high', 'severe', 'extreme']:
            severity_adjustment = 1.3
        elif severity in ['medium', 'moderate']:
            severity_adjustment = 1.1
    
    # Get base multiplier for this resource type
    multiplier = base_multipliers.get(resource_type, 1) * severity_adjustment
    
    # Calculate units needed
    units = people_count * multiplier
    
    # Ensure minimum quantities for certain resources
    if resource_type in ['shelter', 'evacuation', 'rescue']:
        units = max(1, int(units))  # At least 1 unit
    else:
        units = int(units)  # Round to whole number
    
    # Determine unit type
    unit_types = {
        'food': 'meals',
        'water': 'liters',
        'shelter': 'shelter units',
        'medical': 'medical kits',
        'evacuation': 'vehicles',
        'rescue': 'personnel',
        'supplies': 'supply kits',
        'other': 'items'
    }
    
    # Standard return for most resource types
    result = {
        'units': units,
        'unit_type': unit_types.get(resource_type, 'items')
    }
    
    # Special case for medical based on condition
    if resource_type == 'medical' and condition:
        condition = condition.lower()
        if 'fire' in condition:
            result['details'] = {
                'burn_kits': int(units * 0.6),
                'respiratory_kits': int(units * 0.4),
                'general_first_aid': int(units * 0.3)
            }
        elif 'flood' in condition:
            result['details'] = {
                'water_purification': int(units * 0.5),
                'antibiotics': int(units * 0.3),
                'general_first_aid': int(units * 0.4)
            }
        elif 'earthquake' in condition:
            result['details'] = {
                'trauma_kits': int(units * 0.7),
                'surgical_supplies': int(units * 0.4),
                'general_first_aid': int(units * 0.5)
            }
    
    # Special case for food based on condition
    elif resource_type == 'food' and condition:
        condition = condition.lower()
        if 'flood' in condition or 'storm' in condition:
            result['details'] = {
                'ready_to_eat_meals': int(units * 0.7),
                'water_resistant_food': int(units * 0.5),
                'general_first_aid': int(units * 0.3)
            }
        elif 'fire' in condition:
            result['details'] = {
                'burn_kits': int(units * 0.6),
                'general_first_aid': int(units * 0.4)
            }
        elif 'earthquake' in condition:
            result['details'] = {
                'trauma_kits': int(units * 0.7),
                'general_first_aid': int(units * 0.5)
            }
    
    return result

def calculate_distance(lat1, lon1, lat2, lon2):
    """
    Calculate distance between two points in km
    Uses Haversine formula
    """
    from math import radians, cos, sin, asin, sqrt
    
    # Convert decimal degrees to radians
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    
    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    r = 6371  # Radius of earth in kilometers
    
    return c * r
