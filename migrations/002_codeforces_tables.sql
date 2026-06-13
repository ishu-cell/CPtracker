-- Migration 002: Codeforces integration tables
-- Adds tables for CF profiles, contests, participations, problems, submissions, and user-problem status.

-- ═══════════════════════════════════════════════════════
-- codeforces_profiles: One per user. Linked CF identity.
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS codeforces_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  cf_handle VARCHAR(100) NOT NULL,
  cf_rating INT DEFAULT 0,
  cf_max_rating INT DEFAULT 0,
  cf_rank VARCHAR(50) DEFAULT 'newbie',
  cf_max_rank VARCHAR(50) DEFAULT 'newbie',
  cf_avatar VARCHAR(500) NULL,
  cf_title_photo VARCHAR(500) NULL,
  cf_contribution INT DEFAULT 0,
  cf_friend_of_count INT DEFAULT 0,
  cf_registration_time BIGINT NULL,
  last_synced_at TIMESTAMP NULL,
  sync_status ENUM('idle', 'syncing', 'error') DEFAULT 'idle',
  sync_error_message TEXT NULL,
  total_submissions_synced INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cf_handle (cf_handle),
  INDEX idx_sync_status (sync_status)
);

-- ═══════════════════════════════════════════════════════
-- cf_contests: Global contest metadata (shared across users).
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS cf_contests (
  id INT PRIMARY KEY,
  name VARCHAR(500) NOT NULL,
  type ENUM('CF', 'IOI', 'ICPC') DEFAULT 'CF',
  phase VARCHAR(50) NULL,
  duration_seconds INT NULL,
  start_time_seconds BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cf_contests_start_time (start_time_seconds)
);

-- ═══════════════════════════════════════════════════════
-- cf_contest_participation: Per-user contest history + rating changes.
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS cf_contest_participation (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  contest_id INT NOT NULL,
  cf_handle VARCHAR(100) NOT NULL,
  rank_in_contest INT NULL,
  old_rating INT NULL,
  new_rating INT NULL,
  rating_change INT NULL,
  contest_time BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_contest (user_id, contest_id),
  INDEX idx_participation_user (user_id),
  INDEX idx_participation_time (user_id, contest_time)
);

-- ═══════════════════════════════════════════════════════
-- cf_problems: Global problem catalog (~10k rows, shared).
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS cf_problems (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contest_id INT NULL,
  problem_index VARCHAR(10) NOT NULL,
  name VARCHAR(500) NOT NULL,
  rating INT NULL,
  tags JSON NULL,
  solved_count INT DEFAULT 0,
  problem_type VARCHAR(20) DEFAULT 'PROGRAMMING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_contest_index (contest_id, problem_index),
  INDEX idx_cf_problems_rating (rating),
  INDEX idx_cf_problems_solved (solved_count)
);

-- ═══════════════════════════════════════════════════════
-- cf_submissions: Per-user submission history (largest table).
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS cf_submissions (
  id BIGINT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  cf_handle VARCHAR(100) NOT NULL,
  contest_id INT NULL,
  problem_index VARCHAR(10) NULL,
  problem_name VARCHAR(500) NULL,
  problem_rating INT NULL,
  problem_tags JSON NULL,
  verdict VARCHAR(50) NULL,
  programming_language VARCHAR(100) NULL,
  time_consumed_millis INT NULL,
  memory_consumed_bytes BIGINT NULL,
  creation_time_seconds BIGINT NULL,
  relative_time_seconds BIGINT NULL,
  is_practice TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_submissions_user_verdict (user_id, verdict),
  INDEX idx_submissions_user_problem (user_id, contest_id, problem_index),
  INDEX idx_submissions_user_time (user_id, creation_time_seconds),
  INDEX idx_submissions_rating (problem_rating)
);

-- ═══════════════════════════════════════════════════════
-- cf_user_problem_status: Denormalized per-user per-problem status.
-- Rebuilt from submissions during sync.
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS cf_user_problem_status (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  contest_id INT NULL,
  problem_index VARCHAR(10) NULL,
  problem_name VARCHAR(500) NULL,
  problem_rating INT NULL,
  problem_tags JSON NULL,
  status ENUM('solved', 'attempted', 'unsolved') DEFAULT 'unsolved',
  total_attempts INT DEFAULT 0,
  first_attempt_time BIGINT NULL,
  solved_time BIGINT NULL,
  solved_during_contest TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_problem (user_id, contest_id, problem_index),
  INDEX idx_ups_user_status (user_id, status),
  INDEX idx_ups_user_rating (user_id, problem_rating)
);
