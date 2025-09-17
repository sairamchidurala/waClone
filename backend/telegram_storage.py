import requests
import os
from typing import Optional, Tuple

class TelegramStorage:
    def __init__(self):
        self.bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        self.chat_id = os.getenv('TELEGRAM_CHAT_ID')
        if not self.bot_token or not self.chat_id:
            raise ValueError("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set")
        self.base_url = f"https://api.telegram.org/bot{self.bot_token}"
    
    def upload_file(self, file_path: str, file_type: str = 'photo') -> Optional[Tuple[str, str]]:
        """Upload file to Telegram and return (file_id, file_url)"""
        # Validate file path to prevent path traversal
        if not os.path.exists(file_path) or '..' in file_path:
            return None
            
        try:
            with open(file_path, 'rb') as file:
                if file_type == 'photo':
                    response = requests.post(
                        f"{self.base_url}/sendPhoto",
                        data={'chat_id': self.chat_id},
                        files={'photo': file},
                        timeout=30
                    )
                elif file_type == 'video':
                    response = requests.post(
                        f"{self.base_url}/sendVideo",
                        data={'chat_id': self.chat_id},
                        files={'video': file},
                        timeout=30
                    )
                elif file_type == 'document':
                    response = requests.post(
                        f"{self.base_url}/sendDocument",
                        data={'chat_id': self.chat_id},
                        files={'document': file},
                        timeout=30
                    )
                else:
                    return None
                
                if response.status_code == 200:
                    result = response.json()
                    if result['ok']:
                        if file_type == 'photo':
                            file_id = result['result']['photo'][-1]['file_id']
                        elif file_type == 'video':
                            file_id = result['result']['video']['file_id']
                        else:
                            file_id = result['result']['document']['file_id']
                        
                        file_url = self.get_file_url(file_id)
                        return file_id, file_url
                
                return None
        except Exception as e:
            import logging
            logging.error(f"Telegram upload error: {e}")
            return None
    
    def get_file_url(self, file_id: str) -> Optional[str]:
        """Get direct download URL for file_id"""
        try:
            response = requests.get(f"{self.base_url}/getFile?file_id={file_id}", timeout=30)
            if response.status_code == 200:
                result = response.json()
                if result['ok']:
                    file_path = result['result']['file_path']
                    return f"https://api.telegram.org/file/bot{self.bot_token}/{file_path}"
            return None
        except Exception as e:
            import logging
            logging.error(f"Telegram URL error: {e}")
            return None

# Global instance - only create if credentials are available
try:
    telegram_storage = TelegramStorage()
except ValueError:
    telegram_storage = None