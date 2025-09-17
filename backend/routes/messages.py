from flask import Blueprint, request, jsonify, redirect, Response
from flask_login import login_required, current_user
from backend.models import Message, User, db
from backend.telegram_storage import telegram_storage
from backend.encryption import message_encryption
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
import requests
import os

messages_bp = Blueprint('messages', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'mp3', 'wav'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@messages_bp.route('/send', methods=['POST'])
@login_required
def send_message():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Invalid JSON data'}), 400
            
        encrypted_token = data.get('receiver_id')
        content = data.get('content')
        
        if not encrypted_token:
            return jsonify({'error': 'Receiver token required'}), 400
            
        if not content or not content.strip():
            return jsonify({'error': 'Message content required'}), 400
    except Exception:
        return jsonify({'error': 'Invalid JSON data'}), 400
    
    if not encrypted_token:
        return jsonify({'error': 'Receiver token required'}), 400
    
    # Validate secure token
    receiver_id = message_encryption.validate_secure_token(encrypted_token, current_user.id)
    if receiver_id is None:
        return jsonify({'error': 'Invalid or unauthorized token'}), 403
    
    # Validate content before encryption
    if not content or not content.strip():
        return jsonify({'error': 'Message content required'}), 400
    
    # Encrypt message content
    encrypted_content = message_encryption.encrypt_message(content)
    
    try:
        message = Message(
            sender_id=current_user.id,
            receiver_id=receiver_id,
            content=encrypted_content,
            message_type='text'
        )
        db.session.add(message)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to send message'}), 500
    
    # Convert to IST
    ist_timestamp = message.timestamp.replace(tzinfo=None) + timedelta(hours=5, minutes=30)
    return jsonify({
        'id': message.id,
        'content': content,  # Return original content, not encrypted
        'timestamp': ist_timestamp.isoformat(),
        'sender_id': message.sender_id
    }), 201

@messages_bp.route('/send-media', methods=['POST'])
@login_required
def send_media():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    encrypted_receiver_id = request.form.get('receiver_id')
    caption = request.form.get('caption', '')
    
    if not encrypted_receiver_id:
        return jsonify({'error': 'Receiver ID required'}), 400
    
    # Validate receiver ID
    if not encrypted_receiver_id:
        return jsonify({'error': 'Receiver ID required'}), 400
    
    # Get receiver ID directly
    try:
        receiver_id = int(encrypted_receiver_id)
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid receiver ID'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_')
        filename = timestamp + filename
        file_path = os.path.join('uploads', filename)
        file.save(file_path)
        
        # Determine message type based on file extension
        ext = filename.rsplit('.', 1)[1].lower()
        if ext in ['png', 'jpg', 'jpeg', 'gif']:
            message_type = 'image'
            telegram_type = 'photo'
        elif ext in ['mp4']:
            message_type = 'video'
            telegram_type = 'video'
        elif ext in ['mp3', 'wav']:
            message_type = 'audio'
            telegram_type = 'document'
        else:
            message_type = 'file'
            telegram_type = 'document'
        
        # Upload to Telegram (optional)
        telegram_file_id = None
        telegram_file_url = None
        
        if telegram_storage:
            try:
                telegram_result = telegram_storage.upload_file(file_path, telegram_type)
                if telegram_result:
                    telegram_file_id, telegram_file_url = telegram_result
                    # Delete local file after successful upload
                    try:
                        os.remove(file_path)
                        file_path = None
                    except OSError:
                        pass
            except Exception:
                # Continue without Telegram storage if it fails
                pass
        
        content = caption if caption else f"Sent a {message_type}"
        message = Message(
            sender_id=current_user.id,
            receiver_id=receiver_id,
            content=content,
            message_type=message_type,
            file_path=file_path,
            telegram_file_id=telegram_file_id,
            telegram_file_url=telegram_file_url
        )
        db.session.add(message)
        db.session.commit()
        
        # Return secure response without exposing URLs
        # Convert to IST
        ist_timestamp = message.timestamp.replace(tzinfo=None) + timedelta(hours=5, minutes=30)
        return jsonify({
            'id': message.id,
            'content': message.content,
            'message_type': message.message_type,
            'secure_file_id': message.id,  # Use message ID as secure identifier
            'timestamp': ist_timestamp.isoformat()
        }), 201
    
    return jsonify({'error': 'Invalid file type'}), 400

@messages_bp.route('/conversation/<string:encrypted_token>', methods=['GET'])
@login_required
def get_conversation(encrypted_token):
    # Validate secure token
    target_user_id = message_encryption.validate_secure_token(encrypted_token, current_user.id)
    if target_user_id is None:
        return jsonify({'error': 'Invalid or unauthorized token'}), 403
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('limit', 50, type=int)
    offset = (page - 1) * per_page
    
    try:
        total_messages = Message.query.filter(
            ((Message.sender_id == current_user.id) & (Message.receiver_id == target_user_id)) |
            ((Message.sender_id == target_user_id) & (Message.receiver_id == current_user.id))
        ).count()
        
        messages = Message.query.filter(
            ((Message.sender_id == current_user.id) & (Message.receiver_id == target_user_id)) |
            ((Message.sender_id == target_user_id) & (Message.receiver_id == current_user.id))
        ).order_by(Message.timestamp.desc()).offset(offset).limit(per_page).all()
        
        # Reverse to show oldest first within the page
        messages = list(reversed(messages))
    except Exception as e:
        return jsonify({'error': 'Failed to load conversation'}), 500
    
    # Decrypt messages and encrypt API response
    decrypted_messages = []
    for msg in messages:
        decrypted_content = message_encryption.decrypt_message(msg.content) if msg.message_type == 'text' else msg.content
        # Convert to IST
        ist_timestamp = msg.timestamp.replace(tzinfo=None) + timedelta(hours=5, minutes=30)
        message_data = {
            'id': msg.id,
            'content': decrypted_content,
            'message_type': msg.message_type,
            'timestamp': ist_timestamp.isoformat(),
            'sender_id': msg.sender_id,
            'is_read': msg.is_read,
            'is_delivered': getattr(msg, 'is_delivered', False)
        }
        # Add secure file ID for media messages
        if msg.message_type in ['image', 'video', 'audio']:
            message_data['secure_file_id'] = msg.id
        decrypted_messages.append(message_data)
    
    response_data = {
        'messages': decrypted_messages,
        'has_more': offset + len(messages) < total_messages,
        'total': total_messages
    }
    
    return jsonify(message_encryption.encrypt_api_response(response_data)), 200

@messages_bp.route('/contacts', methods=['GET'])
@login_required
def get_contacts():
    try:
        # Get users with their latest message timestamp for sorting
        contacts_query = db.session.query(
            User,
            db.func.max(Message.timestamp).label('last_message_time')
        ).join(
            Message, 
            (Message.sender_id == User.id) | (Message.receiver_id == User.id)
        ).filter(
            ((Message.sender_id == current_user.id) | (Message.receiver_id == current_user.id)) &
            (User.id != current_user.id)
        ).group_by(User.id).order_by(db.desc('last_message_time')).all()
        
        contacts = [contact[0] for contact in contacts_query]
    except Exception as e:
        return jsonify({'error': 'Failed to load contacts'}), 500
    
    contact_list = []
    for user in contacts:
        last_seen_ist = None
        if user.last_seen:
            last_seen_ist = (user.last_seen.replace(tzinfo=None) + timedelta(hours=5, minutes=30)).isoformat()
        
        contact_list.append({
            'id': user.id,
            'name': user.name,
            'phone': user.phone,
            'avatar': user.avatar,
            'is_online': user.is_online,
            'last_seen': last_seen_ist
        })
    
    return jsonify(contact_list), 200

@messages_bp.route('/encrypt-id', methods=['POST'])
@login_required
def encrypt_user_id():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Invalid JSON data'}), 400
            
        target_user_id = data.get('user_id')
        
        if not target_user_id or not isinstance(target_user_id, int):
            return jsonify({'error': 'Valid user ID required'}), 400
    except Exception:
        return jsonify({'error': 'Invalid JSON data'}), 400
    
    # Create secure token that only current user can use
    secure_token = message_encryption.create_secure_token(current_user.id, target_user_id)
    return jsonify({'encrypted_id': secure_token}), 200

@messages_bp.route('/decrypt', methods=['POST'])
@login_required
def decrypt_data():
    data = request.get_json()
    encrypted_data = data.get('encrypted_data')
    
    if not encrypted_data:
        return jsonify({'error': 'No encrypted data provided'}), 400
    
    decrypted = message_encryption.decrypt_api_request(encrypted_data)
    if decrypted is None:
        return jsonify({'error': 'Decryption failed'}), 400
    
    return jsonify({'data': decrypted}), 200

@messages_bp.route('/media/<int:message_id>', methods=['GET'])
@login_required
def get_media_file(message_id):
    try:
        message = Message.query.get_or_404(message_id)
        
        # Check if user has access to this message
        if message.sender_id != current_user.id and message.receiver_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Get file URL (Telegram or local)
        file_url = message.telegram_file_url or (message.file_path and f'/wa/uploads/{message.file_path.split("/")[-1]}')
        
        if not file_url:
            return jsonify({'error': 'File not found'}), 404
        
        # If it's a Telegram URL, proxy the request to hide the bot token
        if file_url.startswith('https://api.telegram.org'):
            try:
                response = requests.get(file_url, timeout=30)
                if response.status_code == 200:
                    return Response(
                        response.content,
                        mimetype=response.headers.get('content-type', 'application/octet-stream'),
                        headers={'Cache-Control': 'max-age=3600'}
                    )
            except Exception:
                pass
        
        # For local files, redirect to the file
        return redirect(file_url)
        
    except Exception as e:
        return jsonify({'error': 'File access failed'}), 500

@messages_bp.route('/mark-delivered/<int:message_id>', methods=['POST'])
@login_required
def mark_message_delivered(message_id):
    try:
        message = Message.query.get_or_404(message_id)
        if message.receiver_id == current_user.id and not getattr(message, 'is_delivered', False):
            message.is_delivered = True
            message.delivered_at = datetime.utcnow()
            db.session.commit()
            return jsonify({'message': 'Message marked as delivered'}), 200
        return jsonify({'error': 'Unauthorized or already delivered'}), 403
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to mark message as delivered'}), 500

@messages_bp.route('/mark-read/<int:message_id>', methods=['POST'])
@login_required
def mark_message_read(message_id):
    try:
        message = Message.query.get_or_404(message_id)
        if message.receiver_id == current_user.id:
            if not getattr(message, 'is_delivered', False):
                message.is_delivered = True
                message.delivered_at = datetime.utcnow()
            message.is_read = True
            message.read_at = datetime.utcnow()
            db.session.commit()
            return jsonify({'message': 'Message marked as read'}), 200
        return jsonify({'error': 'Unauthorized'}), 403
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to mark message as read'}), 500