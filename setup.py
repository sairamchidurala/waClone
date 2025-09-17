#!/usr/bin/env python3
"""
WhatsApp Clone Setup Script
Initializes the database and creates demo users
"""

import os
import sys
from flask import Flask
from backend.models import db, User
from dotenv import load_dotenv

def setup_database():
    """Initialize database and create demo users"""
    
    # Load environment variables
    load_dotenv()
    
    # Create Flask app
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///whatsapp.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Initialize database
    db.init_app(app)
    
    with app.app_context():
        try:
            # Create all tables
            print("Creating database tables...")
            db.create_all()
            
            # Check if demo users already exist
            if User.query.first():
                print("Demo users already exist. Skipping user creation.")
                return
            
            # Create demo users
            print("Creating demo users...")
            
            demo_users = [
                {'phone': '+1234567890', 'name': 'John Doe', 'password': os.getenv('DEMO_PASSWORD', 'demo123')},
                {'phone': '+1234567891', 'name': 'Jane Smith', 'password': os.getenv('DEMO_PASSWORD', 'demo123')},
                {'phone': '+1234567892', 'name': 'Bob Johnson', 'password': os.getenv('DEMO_PASSWORD', 'demo123')},
            ]
            
            for user_data in demo_users:
                user = User(
                    phone=user_data['phone'],
                    name=user_data['name']
                )
                user.set_password(user_data['password'])
                db.session.add(user)
            
            db.session.commit()
            print("Demo users created successfully!")
            
            print("\nDemo Login Credentials:")
            print("Phone: +1234567890, Password: demo123 (John Doe)")
            print("Phone: +1234567891, Password: demo123 (Jane Smith)")
            print("Phone: +1234567892, Password: demo123 (Bob Johnson)")
            
        except Exception as e:
            db.session.rollback()
            import logging
            logging.error(f"Error setting up database: {e}")
            sys.exit(1)

def create_upload_directory():
    """Create uploads directory if it doesn't exist"""
    upload_dir = os.getenv('UPLOAD_FOLDER', 'uploads')
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)
        print(f"Created uploads directory: {upload_dir}")

if __name__ == '__main__':
    print("WhatsApp Clone Setup")
    print("===================")
    
    # Create upload directory
    create_upload_directory()
    
    # Setup database
    setup_database()
    
    print("\nSetup completed successfully!")
    print("Run 'python app.py' to start the application.")