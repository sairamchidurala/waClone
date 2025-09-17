from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import os
import json

class MessageEncryption:
    def __init__(self):
        self.key = self._get_or_create_key()
        self.cipher = Fernet(self.key)
    
    def _get_or_create_key(self):
        """Get encryption key from environment or create new one"""
        key_str = os.getenv('ENCRYPTION_KEY')
        if key_str:
            return key_str.encode()
        
        # Generate new key
        key = Fernet.generate_key()
        import logging
        logging.warning("Generated new encryption key - add ENCRYPTION_KEY to .env file")
        return key
    
    def create_secure_token(self, current_user_id, target_user_id):
        """Create secure token that only works for specific user pair"""
        token_data = f"{current_user_id}:{target_user_id}"
        return self.cipher.encrypt(token_data.encode()).decode()
    
    def validate_secure_token(self, token, current_user_id):
        """Validate token and return target user ID if valid"""
        try:
            decrypted = self.cipher.decrypt(token.encode()).decode()
            token_current_id, target_id = decrypted.split(':')
            
            if int(token_current_id) == current_user_id:
                return int(target_id)
            return None
        except:
            return None
    
    def encrypt_message(self, content):
        """Encrypt message content"""
        if not content:
            return content
        return self.cipher.encrypt(content.encode()).decode()
    
    def decrypt_message(self, encrypted_content):
        """Decrypt message content"""
        if not encrypted_content:
            return encrypted_content
        try:
            return self.cipher.decrypt(encrypted_content.encode()).decode()
        except:
            return encrypted_content  # Return as-is if decryption fails
    
    def encrypt_api_response(self, data):
        """Encrypt entire API response"""
        json_str = json.dumps(data)
        encrypted = self.cipher.encrypt(json_str.encode()).decode()
        return {'encrypted_data': encrypted}
    
    def decrypt_api_request(self, encrypted_data):
        """Decrypt API request data"""
        try:
            decrypted = self.cipher.decrypt(encrypted_data.encode()).decode()
            return json.loads(decrypted)
        except:
            return None

# Global instance
message_encryption = MessageEncryption()