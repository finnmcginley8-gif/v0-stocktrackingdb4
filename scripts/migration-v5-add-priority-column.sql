-- Add priority column to wca_main table
-- Priority levels: None (default), High, Medium, Low

ALTER TABLE wca_main 
ADD COLUMN priority TEXT NOT NULL DEFAULT 'None';

-- Add CHECK constraint to ensure valid priority values
ALTER TABLE wca_main
ADD CONSTRAINT chk_priority CHECK (priority IN ('None', 'High', 'Medium', 'Low'));

-- Create index on priority for efficient filtering
CREATE INDEX idx_wca_main_priority ON wca_main(priority);
