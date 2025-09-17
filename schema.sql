-- WhatsApp Clone Database Schema

CREATE DATABASE IF NOT EXISTS whatsapp_db;
USE whatsapp_db;

-- Users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar VARCHAR(255) DEFAULT 'default.png',
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_online BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phone (phone),
    INDEX idx_online (is_online)
);

-- Messages table
CREATE TABLE messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    content TEXT,
    message_type VARCHAR(20) DEFAULT 'text',
    file_path VARCHAR(255),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_conversation (sender_id, receiver_id, timestamp),
    INDEX idx_timestamp (timestamp),
    INDEX idx_unread (receiver_id, is_read)
);

-- Calls table
CREATE TABLE calls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    caller_id INT NOT NULL,
    receiver_id INT NOT NULL,
    call_type VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'initiated',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    duration INT DEFAULT 0,
    FOREIGN KEY (caller_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_calls (caller_id, started_at),
    INDEX idx_receiver_calls (receiver_id, started_at)
);

-- Insert demo users
INSERT INTO users (phone, name, password_hash) VALUES
('+1234567890', 'John Doe', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PmvlG.'), -- password: demo123
('+1234567891', 'Jane Smith', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PmvlG.'), -- password: demo123
('+1234567892', 'Bob Johnson', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PmvlG.'); -- password: demo123

-- Insert demo messages
INSERT INTO messages (sender_id, receiver_id, content, message_type) VALUES
(1, 2, 'Hello Jane! How are you?', 'text'),
(2, 1, 'Hi John! I am doing great, thanks for asking.', 'text'),
(1, 2, 'That is wonderful to hear!', 'text'),
(3, 1, 'Hey John, are we still meeting today?', 'text'),
(1, 3, 'Yes, see you at 3 PM!', 'text');