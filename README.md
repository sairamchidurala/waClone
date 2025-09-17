# WhatsApp Clone

A complete WhatsApp-like messaging application built with Flask backend and vanilla JavaScript frontend, using AWS RDS for database storage.

## Features

- **User Authentication** - Register, login, logout
- **Real-time Messaging** - Text messages with Socket.IO
- **Media Sharing** - Images, videos, audio files
- **Voice/Video Calls** - WebRTC-based calling system
- **Contact Management** - View contacts and online status
- **Responsive UI** - WhatsApp-like interface with Tailwind CSS
- **File Upload** - Support for multiple media types
- **Call History** - Track all calls made and received
- **Real-time Notifications** - Browser notifications for new messages

## Tech Stack

### Backend
- **Flask** - Web framework
- **Flask-SocketIO** - Real-time communication
- **Flask-SQLAlchemy** - Database ORM
- **Flask-Login** - User session management
- **MySQL** - Database (AWS RDS compatible)
- **bcrypt** - Password hashing

### Frontend
- **Vanilla JavaScript** - No framework dependencies
- **Socket.IO Client** - Real-time messaging
- **Tailwind CSS** - Styling
- **Font Awesome** - Icons
- **WebRTC** - Peer-to-peer calling

## Quick Start

### Using Docker Compose (Recommended)

1. **Clone and setup**:
   ```bash
   cd whatsapp
   cp .env.example .env
   ```

2. **Start all services**:
   ```bash
   docker-compose up -d
   ```

3. **Access the application**:
   - Application: http://localhost:5000
   - MySQL: localhost:3306
   - Redis: localhost:6379

### Manual Setup

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Setup MySQL database**:
   ```bash
   # Create database and run schema
   mysql -u root -p < schema.sql
   ```

3. **Configure environment**:
   ```bash
   # Update .env file with your database credentials
   DATABASE_URL=mysql+pymysql://username:password@localhost:3306/whatsapp_db
   ```

4. **Run the application**:
   ```bash
   python app.py
   ```

## AWS RDS Setup

### 1. Create RDS Instance
```bash
# Using AWS CLI
aws rds create-db-instance \
    --db-instance-identifier whatsapp-db \
    --db-instance-class db.t3.micro \
    --engine mysql \
    --master-username admin \
    --master-user-password your-password \
    --allocated-storage 20 \
    --vpc-security-group-ids sg-xxxxxxxxx \
    --db-name whatsapp_db
```

### 2. Update Environment Variables
```bash
# In .env file
DATABASE_URL=mysql+pymysql://admin:your-password@whatsapp-db.xxxxxxxxx.us-east-1.rds.amazonaws.com:3306/whatsapp_db
```

### 3. Initialize Database
```bash
# Connect to RDS and run schema
mysql -h whatsapp-db.xxxxxxxxx.us-east-1.rds.amazonaws.com -u admin -p whatsapp_db < schema.sql
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user info

### Messages
- `POST /api/messages/send` - Send text message
- `POST /api/messages/send-media` - Send media file
- `GET /api/messages/conversation/<user_id>` - Get conversation history
- `GET /api/messages/contacts` - Get user contacts
- `POST /api/messages/mark-read/<message_id>` - Mark message as read

### Calls
- `POST /api/calls/initiate` - Start a call
- `POST /api/calls/<call_id>/answer` - Answer incoming call
- `POST /api/calls/<call_id>/end` - End active call
- `POST /api/calls/<call_id>/reject` - Reject incoming call
- `GET /api/calls/history` - Get call history

## Socket.IO Events

### Client → Server
- `join_room` - Join chat room
- `leave_room` - Leave chat room
- `send_message` - Send real-time message
- `call_signal` - WebRTC signaling

### Server → Client
- `receive_message` - Receive new message
- `call_signal` - Call-related signals
- `user_status` - User online/offline status

## Usage

### 1. Register/Login
- Navigate to http://localhost:5000
- Register new account or login with demo credentials:
  - Phone: `+1234567890`, Password: `demo123`
  - Phone: `+1234567891`, Password: `demo123`

### 2. Send Messages
- Select a contact from the sidebar
- Type message and press Enter or click send button
- Attach files using the paperclip icon

### 3. Make Calls
- Select a contact and click audio/video call buttons
- Accept/reject incoming calls from the call modal
- End calls using the red button

### 4. File Sharing
- Click attachment button to upload images, videos, or audio
- Supported formats: PNG, JPG, GIF, MP4, MP3, WAV
- Files are stored in `/uploads` directory

## Configuration

### Environment Variables
```bash
FLASK_ENV=development
SECRET_KEY=your-secret-key-here
DATABASE_URL=mysql+pymysql://user:pass@host:port/db
UPLOAD_FOLDER=uploads
MAX_CONTENT_LENGTH=16777216  # 16MB
```

### File Upload Limits
- Maximum file size: 16MB
- Supported types: Images, videos, audio files
- Files stored locally in `uploads/` directory

### Database Configuration
- Connection pooling enabled
- Automatic table creation on first run
- Foreign key constraints for data integrity

## Security Features

- **Password Hashing** - bcrypt with salt
- **Session Management** - Flask-Login with secure sessions
- **File Validation** - Secure filename handling
- **SQL Injection Protection** - SQLAlchemy ORM
- **CORS Configuration** - Controlled cross-origin requests

## Production Deployment

### 1. Environment Setup
```bash
# Production environment variables
FLASK_ENV=production
SECRET_KEY=strong-random-secret-key
DATABASE_URL=mysql+pymysql://user:pass@rds-endpoint:3306/db
```

### 2. HTTPS Configuration
```python
# For production, enable HTTPS
if __name__ == '__main__':
    socketio.run(app, 
                host='0.0.0.0', 
                port=5000,
                ssl_context='adhoc')  # or provide cert files
```

### 3. Reverse Proxy (Nginx)
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check DATABASE_URL format
   - Verify MySQL server is running
   - Ensure database exists and schema is loaded

2. **File Upload Issues**
   - Check uploads directory permissions
   - Verify MAX_CONTENT_LENGTH setting
   - Ensure supported file types

3. **Socket.IO Connection Failed**
   - Check CORS configuration
   - Verify port accessibility
   - Check browser console for errors

4. **WebRTC Call Issues**
   - Ensure HTTPS for getUserMedia
   - Check browser permissions for camera/microphone
   - Verify STUN/TURN server configuration

### Logs and Debugging
```bash
# Enable Flask debug mode
export FLASK_ENV=development

# Check application logs
docker-compose logs app

# Check database logs
docker-compose logs mysql
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes and test
4. Submit pull request

## Support

For issues and questions:
- Check the troubleshooting section
- Review application logs
- Create GitHub issue with details