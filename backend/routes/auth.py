from flask import Blueprint, request, jsonify, session
from flask_login import login_user, logout_user, login_required, current_user
from backend.models import User, db

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Invalid JSON data'}), 400
            
        phone = data.get('phone')
        name = data.get('name')
        password = data.get('password')
        
        if not all([phone, name, password]):
            return jsonify({'error': 'Phone, name, and password are required'}), 400
    except Exception:
        return jsonify({'error': 'Invalid JSON data'}), 400
    
    if User.query.filter_by(phone=phone).first():
        return jsonify({'error': 'Phone number already registered'}), 400
    
    try:
        user = User(phone=phone, name=name)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Registration failed'}), 500
    
    return jsonify({'message': 'User registered successfully'}), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Invalid JSON data'}), 400
            
        phone = data.get('phone')
        password = data.get('password')
        
        if not all([phone, password]):
            return jsonify({'error': 'Phone and password are required'}), 400
    except Exception:
        return jsonify({'error': 'Invalid JSON data'}), 400
    
    user = User.query.filter_by(phone=phone).first()
    if user and user.check_password(password):
        try:
            login_user(user)
            user.is_online = True
            db.session.commit()
            return jsonify({
                'message': 'Login successful',
                'user': {
                    'id': user.id,
                    'phone': user.phone,
                    'name': user.name,
                    'avatar': user.avatar
                }
            }), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': 'Login failed'}), 500
    
    return jsonify({'error': 'Invalid credentials'}), 401

@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    try:
        current_user.is_online = False
        db.session.commit()
        logout_user()
        return jsonify({'message': 'Logged out successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Logout failed'}), 500

@auth_bp.route('/me', methods=['GET'])
@login_required
def get_current_user():
    return jsonify({
        'id': current_user.id,
        'phone': current_user.phone,
        'name': current_user.name,
        'avatar': current_user.avatar,
        'is_online': current_user.is_online
    }), 200

@auth_bp.route('/update-profile', methods=['POST'])
@login_required
def update_profile():
    data = request.get_json()
    name = data.get('name')
    
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    
    try:
        current_user.name = name
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Profile update failed'}), 500
    
    return jsonify({
        'message': 'Profile updated successfully',
        'user': {
            'id': current_user.id,
            'phone': current_user.phone,
            'name': current_user.name,
            'avatar': current_user.avatar
        }
    }), 200