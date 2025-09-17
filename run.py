#!/usr/bin/env python3
"""
Quick start script for WhatsApp Clone
"""

import os
import subprocess
import sys

def install_dependencies():
    """Install Python dependencies"""
    print("Installing dependencies...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])

def setup_app():
    """Setup the application"""
    print("Setting up application...")
    subprocess.check_call([sys.executable, "setup.py"])

def run_app():
    """Run the Flask application"""
    print("Starting WhatsApp Clone...")
    print("Access the app at: http://localhost:5001")
    print("Demo login: +1234567890 / demo123")
    subprocess.check_call([sys.executable, "app.py"])

if __name__ == "__main__":
    try:
        install_dependencies()
        setup_app()
        run_app()
    except KeyboardInterrupt:
        print("\nApplication stopped.")
    except subprocess.CalledProcessError as e:
        print(f"Command failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)