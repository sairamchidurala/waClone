from flask import Blueprint, request, jsonify, session
from flask_login import login_user, logout_user, login_required, current_user
from backend.models import User, db
from backend.telegram_storage import telegram_storage
from werkzeug.utils import secure_filename
from datetime import datetime
import os
import uuid

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
        force_login = data.get('force_login', False)
        
        if not all([phone, password]):
            return jsonify({'error': 'Phone and password are required'}), 400
    except Exception:
        return jsonify({'error': 'Invalid JSON data'}), 400
    
    user = User.query.filter_by(phone=phone).first()
    if user and user.check_password(password):
        try:
            # Check if user is already logged in elsewhere
            if user.is_online and user.session_id and not force_login:
                return jsonify({
                    'error': 'already_logged_in',
                    'message': 'This account is already logged in from another device. Do you want to close that session and login here?'
                }), 409
            
            # Force logout from other sessions
            if user.session_id:
                user.session_id = None
                user.is_online = False
                db.session.commit()
            
            # Generate new session ID and login
            new_session_id = str(uuid.uuid4())
            user.session_id = new_session_id
            user.is_online = True
            
            login_user(user)
            session['user_session_id'] = new_session_id
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
        current_user.session_id = None
        session.pop('user_session_id', None)
        db.session.commit()
        logout_user()
        return jsonify({'message': 'Logged out successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Logout failed'}), 500

@auth_bp.route('/me', methods=['GET'])
@login_required
def get_current_user():
    # Double-check session validity
    session_id = session.get('user_session_id')
    if not session_id or current_user.session_id != session_id:
        return jsonify({'error': 'Session expired'}), 401
    
    return jsonify({
        'id': current_user.id,
        'phone': current_user.phone,
        'name': current_user.name,
        'avatar': current_user.avatar,
        'is_online': current_user.is_online,
        'is_private': current_user.is_private
    }), 200

@auth_bp.route('/check-session', methods=['GET'])
def check_session():
    """Check if current session is valid"""
    if current_user.is_authenticated:
        session_id = session.get('user_session_id')
        if session_id and current_user.session_id == session_id:
            return jsonify({'valid': True}), 200
    return jsonify({'valid': False}), 401

@auth_bp.route('/update-profile', methods=['POST'])
@login_required
def update_profile():
    data = request.get_json()
    name = data.get('name')
    is_private = data.get('is_private')
    
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    
    try:
        current_user.name = name
        if is_private is not None:
            current_user.is_private = bool(is_private)
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
            'avatar': current_user.avatar,
            'is_private': current_user.is_private
        }
    }), 200

@auth_bp.route('/upload-avatar', methods=['POST'])
@login_required
def upload_avatar():
    if 'avatar' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['avatar']
    if not file or file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Check file type
    allowed_extensions = {'png', 'jpg', 'jpeg', 'gif'}
    if not ('.' in file.filename and file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
        return jsonify({'error': 'Invalid file type. Only PNG, JPG, JPEG, GIF allowed'}), 400
    
    try:
        # Save temporarily for Telegram upload
        filename = f"avatar_{current_user.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{file.filename.rsplit('.', 1)[1].lower()}"
        temp_path = os.path.join('uploads', filename)
        
        # Ensure uploads directory exists
        os.makedirs('uploads', exist_ok=True)
        file.save(temp_path)
        
        # Upload to Telegram
        avatar_url = None
        if telegram_storage:
            try:
                telegram_result = telegram_storage.upload_file(temp_path, 'photo')
                if telegram_result:
                    _, avatar_url = telegram_result
                    # Delete local file after successful upload
                    try:
                        os.remove(temp_path)
                    except OSError:
                        pass
            except Exception as e:
                print(f"Telegram avatar upload error: {e}")
        
        if not avatar_url:
            # Fallback to local storage if Telegram fails
            avatar_url = f'/wa/uploads/{filename}'
        
        # Update user avatar
        current_user.avatar = avatar_url
        db.session.commit()
        
        return jsonify({
            'message': 'Avatar updated successfully',
            'avatar_url': avatar_url,
            'user': {
                'id': current_user.id,
                'phone': current_user.phone,
                'name': current_user.name,
                'avatar': current_user.avatar
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Avatar upload error: {e}")
        return jsonify({'error': 'Avatar upload failed'}), 500