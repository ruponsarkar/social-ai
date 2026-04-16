CREATE DATABASE IF NOT EXISTS social_media_manager;
USE social_media_manager;

CREATE TABLE IF NOT EXISTS keywords (
  id INT AUTO_INCREMENT PRIMARY KEY,
  keyword VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'general',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_connections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  platform ENUM('facebook', 'instagram', 'youtube') NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  access_token TEXT NULL,
  refresh_token TEXT NULL,
  page_id VARCHAR(255) NULL,
  channel_id VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS content_jobs (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content_type ENUM('text', 'image', 'video') NOT NULL,
  enhance_prompt TINYINT(1) NOT NULL DEFAULT 1,
  target_platforms JSON NOT NULL,
  status ENUM('draft', 'scheduled', 'processing', 'published', 'failed') NOT NULL DEFAULT 'draft',
  prompt_template TEXT NOT NULL,
  scheduled_at DATETIME NOT NULL,
  publish_every_other_day TINYINT(1) NOT NULL DEFAULT 0,
  repeat_interval VARCHAR(32) NULL,
  last_run_at DATETIME NULL,
  next_run_at DATETIME NULL,
  generated_text LONGTEXT NULL,
  generated_image_url TEXT NULL,
  generated_video_url TEXT NULL,
  ai_source VARCHAR(64) NULL,
  ai_response_payload LONGTEXT NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS content_job_keywords (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id CHAR(36) NOT NULL,
  keyword_id INT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES content_jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (keyword_id) REFERENCES keywords(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS publish_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id CHAR(36) NOT NULL,
  platform ENUM('facebook', 'instagram', 'youtube') NOT NULL,
  status ENUM('success', 'failed') NOT NULL,
  external_post_id VARCHAR(255) NULL,
  payload JSON NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES content_jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS published_content (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id CHAR(36) NOT NULL,
  platform ENUM('facebook', 'instagram', 'youtube') NOT NULL,
  content_text LONGTEXT NULL,
  content_image_url TEXT NULL,
  content_video_url TEXT NULL,
  ai_source VARCHAR(64) NULL,
  ai_response_payload LONGTEXT NULL,
  external_post_id VARCHAR(255) NULL,
  published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS oauth_states (
  id INT AUTO_INCREMENT PRIMARY KEY,
  provider ENUM('meta', 'google') NOT NULL,
  state_token VARCHAR(255) NOT NULL UNIQUE,
  return_to TEXT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO keywords (keyword, category) VALUES
  ('digital marketing', 'marketing'),
  ('healthy lifestyle', 'wellness'),
  ('travel inspiration', 'travel'),
  ('startup productivity', 'business')
ON DUPLICATE KEY UPDATE keyword = VALUES(keyword);
