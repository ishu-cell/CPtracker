-- Migration 003: Analytics, training, and goal tables

-- ═══════════════════════════════════════════════════════
-- cf_tag_stats: Per-user per-tag aggregated statistics.
-- Rebuilt on sync. Core input for weakness detection.
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS cf_tag_stats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  tag VARCHAR(100) NOT NULL,
  total_attempted INT DEFAULT 0,
  total_solved INT DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0.00,
  avg_rating_solved DECIMAL(7,2) NULL,
  max_rating_solved INT NULL,
  avg_attempts_to_solve DECIMAL(5,2) DEFAULT 1.00,
  last_practiced_at BIGINT NULL,
  weakness_score DECIMAL(5,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_tag (user_id, tag),
  INDEX idx_tag_weakness (user_id, weakness_score DESC)
);

-- ═══════════════════════════════════════════════════════
-- daily_challenges: Per-user daily training assignments.
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS daily_challenges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  challenge_date DATE NOT NULL,
  contest_id INT NULL,
  problem_index VARCHAR(10) NULL,
  problem_name VARCHAR(500) NULL,
  problem_rating INT NULL,
  problem_tags JSON NULL,
  target_tag VARCHAR(100) NULL,
  difficulty_mode ENUM('easy', 'medium', 'hard', 'stretch') DEFAULT 'medium',
  status ENUM('pending', 'solved', 'skipped', 'expired') DEFAULT 'pending',
  solved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_date (user_id, challenge_date),
  INDEX idx_daily_user_status (user_id, status)
);

-- ═══════════════════════════════════════════════════════
-- training_streaks: Per-user streak tracking.
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS training_streaks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_active_date DATE NULL,
  total_problems_solved INT DEFAULT 0,
  total_practice_days INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════
-- user_goals: Per-user rating goals.
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_goals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  goal_type ENUM('rating', 'problems_per_week', 'streak', 'custom') DEFAULT 'rating',
  target_value INT NOT NULL,
  current_value INT DEFAULT 0,
  deadline DATE NULL,
  status ENUM('active', 'achieved', 'abandoned') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_goals_user_active (user_id, status)
);

-- ═══════════════════════════════════════════════════════
-- whiteboard_versions: Version history for whiteboard snapshots.
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS whiteboard_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  problem_id INT NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  version_number INT NOT NULL,
  whiteboard_data JSON NULL,
  snapshot_label VARCHAR(200) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_problem_version (problem_id, user_id, version_number),
  INDEX idx_wb_problem (problem_id, user_id)
);
