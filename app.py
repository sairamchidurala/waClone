from flask import Flask, render_template, send_from_directory
from flask_login import LoginManager
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask import request
from backend.models import db, User
from backend.routes.auth import auth_bp
from backend.routes.messages import messages_bp
from backend.routes.calls import calls_bp
from backend.routes.users import users_bp
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__, template_folder='frontend/templates', static_folder='frontend/static')
app.config['APPLICATION_ROOT'] = '/wa'
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///whatsapp.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER', 'uploads')
try:
    app.config['MAX_CONTENT_LENGTH'] = int(os.getenv('MAX_CONTENT_LENGTH', 16 * 1024 * 1024))
except ValueError:
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

# Initialize extensions
db.init_app(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
socketio = SocketIO(app, cors_allowed_origins="*", path='/wa/socket.io')

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

# Register blueprints
app.register_blueprint(auth_bp, url_prefix='/wa/api/auth')
app.register_blueprint(messages_bp, url_prefix='/wa/api/messages')
app.register_blueprint(calls_bp, url_prefix='/wa/api/calls')
app.register_blueprint(users_bp, url_prefix='/wa/api/users')

# Routes
@app.route('/')
@app.route('/wa/')
def index():
    return render_template('index.html')

@app.route('/login')
@app.route('/wa/login')
def login_page():
    return render_template('login.html')

@app.route('/register')
@app.route('/wa/register')
def register_page():
    return render_template('register.html')

@app.route('/settings')
@app.route('/wa/settings')
def settings_page():
    return render_template('settings.html')

@app.route('/uploads/<filename>')
@app.route('/wa/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/wa/static/<path:filename>')
def static_files(filename):
    return send_from_directory('frontend/static', filename)

# Socket.IO events
@socketio.on('connect')
def handle_connect():
    import logging
    logging.info('Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    import logging
    logging.info('Client disconnected')

@socketio.on('join_room')
def handle_join_room(data):
    room = data['room']
    join_room(room)
    import logging
    logging.info(f'User joined room: {room}')
    emit('status', {'msg': f'Joined room {room}'})
    
    # Test emit to verify room membership
    emit('room_joined', {'room': room}, room=room)

@socketio.on('test_room')
def handle_test_room(data):
    room = data['room']
    import logging
    logging.info(f'Testing room: {room}')
    emit('room_test_result', {'room': room, 'status': 'ok'}, room=room)

@socketio.on('leave_room')
def handle_leave_room(data):
    room = data['room']
    leave_room(room)
    emit('status', {'msg': f'Left room {room}'})

@socketio.on('send_message')
def handle_message(data):
    room = data['room']
    import logging
    logging.info(f'Broadcasting message to room: {room}')
    emit('receive_message', data, room=room, include_self=False)
    
    # Auto-emit delivery confirmation for the message
    if 'message' in data and 'id' in data['message']:
        socketio.sleep(0.1)  # Small delay to ensure message is saved
        socketio.emit('message_delivered', {
            'message_id': data['message']['id']
        })

@socketio.on('call_signal')
def handle_call_signal(data):
    if not data or not isinstance(data, dict):
        return
        
    if 'receiver_id' in data and 'type' in data:
        receiver_room = f'user_{data["receiver_id"]}'
        import logging
        logging.info(f'Call signal: {data["type"]} to receiver: {data["receiver_id"]}')
        logging.info(f'Broadcasting to room: {receiver_room}')
        emit('call_signal', data, room=receiver_room, include_self=False)
    elif 'room' in data and 'type' in data:
        room = data['room']
        import logging
        logging.info(f'Call signal: {data["type"]} to room: {room}')
        emit('call_signal', data, room=room, include_self=False)

@socketio.on('webrtc_offer')
def handle_webrtc_offer(data):
    emit('webrtc_offer', data, room=data['room'], include_self=False)

@socketio.on('webrtc_answer')
def handle_webrtc_answer(data):
    emit('webrtc_answer', data, room=data['room'], include_self=False)

@socketio.on('webrtc_ice')
def handle_webrtc_ice(data):
    emit('webrtc_ice', data, room=data['room'], include_self=False)

@socketio.on('message_delivered')
def handle_message_delivered(data):
    from backend.models import Message
    from datetime import datetime
    
    message_id = data.get('message_id')
    if message_id:
        message = Message.query.get(message_id)
        if message and not message.is_delivered:
            message.is_delivered = True
            message.delivered_at = datetime.utcnow()
            db.session.commit()
            
            # Notify sender
            sender_room = f'user_{message.sender_id}'
            emit('message_status_update', {
                'message_id': message_id,
                'status': 'delivered'
            }, room=sender_room)

@socketio.on('message_read')
def handle_message_read(data):
    from backend.models import Message
    from datetime import datetime
    
    message_id = data.get('message_id')
    if message_id:
        message = Message.query.get(message_id)
        if message:
            if not message.is_delivered:
                message.is_delivered = True
                message.delivered_at = datetime.utcnow()
            message.is_read = True
            message.read_at = datetime.utcnow()
            db.session.commit()
            
            # Notify sender
            sender_room = f'user_{message.sender_id}'
            emit('message_status_update', {
                'message_id': message_id,
                'status': 'read'
            }, room=sender_room)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    debug_mode = os.getenv('FLASK_ENV') == 'development'
socketio.run(app, debug=debug_mode, host='0.0.0.0', port=5001)