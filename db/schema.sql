-- Propstream Automation Platform Database Schema
-- Production-grade SaaS architecture

-- Organizations (multi-tenant)
CREATE TABLE organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  propstream_email VARCHAR(255),
  propstream_password_encrypted TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Users (team members within orgs)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'member', -- admin, member, viewer
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);

-- Export jobs queue
CREATE TABLE export_jobs (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
  -- Job details
  list_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed, cancelled
  priority INTEGER DEFAULT 0, -- Higher = processed first
  
  -- Execution tracking
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  agent_session_key VARCHAR(255), -- Clawdbot sub-agent session
  
  -- Results
  result_file_path TEXT,
  row_count INTEGER,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_export_jobs_status ON export_jobs(status);
CREATE INDEX idx_export_jobs_org ON export_jobs(organization_id);
CREATE INDEX idx_export_jobs_created ON export_jobs(created_at DESC);

-- Job logs (for debugging and audit trail)
CREATE TABLE job_logs (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES export_jobs(id) ON DELETE CASCADE,
  level VARCHAR(20), -- info, warning, error
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usage tracking (for billing)
CREATE TABLE usage_records (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  job_id INTEGER REFERENCES export_jobs(id) ON DELETE SET NULL,
  
  -- Usage metrics
  export_count INTEGER DEFAULT 1,
  ai_tokens_used INTEGER,
  ai_cost_usd DECIMAL(10, 4),
  
  -- Billing period
  period_month VARCHAR(7), -- YYYY-MM format
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usage_period ON usage_records(organization_id, period_month);

-- Automated lists (cache of available lists from Propstream)
CREATE TABLE propstream_lists (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  list_name VARCHAR(255) NOT NULL,
  property_count INTEGER,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, list_name)
);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_export_jobs_updated_at BEFORE UPDATE ON export_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default organization for development
INSERT INTO organizations (name, slug, propstream_email, propstream_password_encrypted)
VALUES ('Praxis Dev Co', 'praxis-dev', NULL, NULL);
