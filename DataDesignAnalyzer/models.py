from app import db
import datetime

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    contact = db.Column(db.String(100), nullable=False)
    location_lat = db.Column(db.Float, nullable=True)
    location_lng = db.Column(db.Float, nullable=True)
    location_name = db.Column(db.String(200), nullable=True)
    role = db.Column(db.String(20), nullable=False)  # 'victim' or 'volunteer'
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    # Relationship with Help Requests (for victims)
    help_requests = db.relationship('HelpRequest', backref='victim', lazy=True)
    
    # Relationship with Volunteer Skills (for volunteers)
    skills = db.relationship('VolunteerSkill', backref='volunteer', lazy=True)
    
    # Relationship with Matches
    victim_matches = db.relationship('Match', backref='victim', lazy=True, foreign_keys='Match.victim_id')
    volunteer_matches = db.relationship('Match', backref='volunteer', lazy=True, foreign_keys='Match.volunteer_id')


class HelpRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    victim_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    help_type = db.Column(db.String(50), nullable=False)  # food, shelter, medical, etc.
    description = db.Column(db.Text, nullable=True)
    people_affected = db.Column(db.Integer, nullable=False, default=1)
    image_data = db.Column(db.LargeBinary, nullable=True)
    damage_level = db.Column(db.String(20), nullable=True)  # Determined by AI
    urgency_level = db.Column(db.String(20), nullable=False, default='medium')  # low, medium, high
    status = db.Column(db.String(20), nullable=False, default='pending')  # pending, matched, resolved
    weather_condition = db.Column(db.String(50), nullable=True)
    location_lat = db.Column(db.Float, nullable=True)
    location_lng = db.Column(db.Float, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    
    # Relationship with Matches
    matches = db.relationship('Match', backref='help_request', lazy=True)


class VolunteerSkill(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    volunteer_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    skill_type = db.Column(db.String(50), nullable=False)  # medical, driving, cooking, etc.
    resource = db.Column(db.String(100), nullable=True)  # vehicle, food, shelter, medical_supplies, etc.
    resource_quantity = db.Column(db.Integer, nullable=True)
    availability = db.Column(db.String(50), nullable=False, default='available')  # available, busy, unavailable
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)


class Match(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    help_request_id = db.Column(db.Integer, db.ForeignKey('help_request.id'), nullable=False)
    victim_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    volunteer_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='pending')  # pending, accepted, completed, cancelled
    match_score = db.Column(db.Float, nullable=False)  # AI-generated match score
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class ResourceForecast(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    location_lat = db.Column(db.Float, nullable=False)
    location_lng = db.Column(db.Float, nullable=False)
    location_name = db.Column(db.String(200), nullable=True)
    resource_type = db.Column(db.String(50), nullable=False)  # food, shelter, medical, etc.
    predicted_demand = db.Column(db.Integer, nullable=False)
    prediction_confidence = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
