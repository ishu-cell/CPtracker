-- Migration 001: Ensure initial problems table schema
-- This is a safety migration — the table may already exist from manual setup.

CREATE TABLE IF NOT EXISTS problems (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  platform VARCHAR(50) DEFAULT 'Codeforces',
  rating INT NULL,
  status ENUM('attempted', 'solved') DEFAULT 'attempted',
  whiteboard_data JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_problems_user_id (user_id)
);
