-- Add message status fields to messages table
ALTER TABLE messages 
ADD COLUMN is_delivered BOOLEAN DEFAULT FALSE AFTER is_read,
ADD COLUMN delivered_at DATETIME NULL AFTER is_delivered,
ADD COLUMN read_at DATETIME NULL AFTER delivered_at;

-- Add indexes for better performance
CREATE INDEX idx_message_status ON messages(sender_id, is_delivered, is_read);
CREATE INDEX idx_delivered_at ON messages(delivered_at);
CREATE INDEX idx_read_at ON messages(read_at);