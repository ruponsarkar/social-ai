-- Add enhance_prompt column to content_jobs table
ALTER TABLE content_jobs ADD COLUMN enhance_prompt TINYINT(1) NOT NULL DEFAULT 1 AFTER content_type;