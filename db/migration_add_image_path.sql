-- Add generated_image_path column to content_jobs table
ALTER TABLE content_jobs ADD COLUMN generated_image_path TEXT NULL AFTER generated_image_url;
