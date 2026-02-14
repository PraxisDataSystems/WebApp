# Propstream Automation Platform - Architecture

## Overview

A production-grade SaaS platform for automating Propstream property exports using AI agents. Built for scalability, reliability, and multi-tenant deployment.

## Architecture Components

```
┌──────────────────┐
│   Next.js App    │  ← Web UI + API Routes
│  (Port 3000)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   PostgreSQL     │  ← Job Queue + Data Store
│   (Port 5432)    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Worker Service  │  ← 24/7 Job Processor
│  (Background)    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Spike (Agent)   │  ← Spawns AI Agents
│  (Heartbeat)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Clawdbot Agents │  ← Execute Exports
│  (Sonnet/Opus)   │
└──────────────────┘
```

## Technology Stack

- **Frontend:** Next.js 14, React, Tailwind CSS
- **Backend:** Node.js, TypeScript
- **Database:** PostgreSQL 16
- **AI:** Clawdbot (Claude Sonnet 4.5 / Opus)
- **Process Manager:** PM2
- **Browser Automation:** Playwright (via AI agents)

## Database Schema

### Core Tables

- **organizations** - Multi-tenant org management
- **users** - Team members within orgs
- **export_jobs** - Job queue with status tracking
- **job_logs** - Audit trail and debugging
- **usage_records** - Billing and quotas
- **propstream_lists** - Cached list metadata

### Job States

1. `pending` - Waiting for worker
2. `processing` - Agent working on it
3. `completed` - Success
4. `failed` - Error (auto-retry up to 3x)
5. `cancelled` - Manual cancellation

## Request Flow

### 1. User Clicks "Export" Button

```typescript
// POST /api/export
{
  listName: "Vol Flip - New",
  organizationId: 1  // Optional, defaults to env DEFAULT_ORG_ID
}
```

**Response:**
```json
{
  "success": true,
  "job": {
    "id": 42,
    "status": "pending",
    "listName": "Vol Flip - New"
  }
}
```

### 2. Worker Picks Up Job

The worker service polls every 10 seconds:

```sql
SELECT * FROM export_jobs
WHERE status = 'pending' AND retry_count < 3
ORDER BY priority DESC, created_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED
```

### 3. Worker Requests Agent Spawn

Writes to `/tmp/worker-spawn-request.json`:

```json
{
  "jobId": 42,
  "task": "Login to Propstream and export...",
  "label": "propstream-job-42",
  "model": "anthropic/claude-sonnet-4-5",
  "outputPath": "/path/to/export.csv"
}
```

### 4. Spike Spawns Agent (via Heartbeat)

Checks for spawn request every ~10s, spawns agent via `sessions_spawn` tool.

### 5. Agent Executes Export

- Logs into Propstream
- Handles overlay popups dynamically
- Navigates to the specified list
- Exports to CSV
- Updates database directly:

```sql
UPDATE export_jobs
SET status='completed',
    completed_at=CURRENT_TIMESTAMP,
    result_file_path='/path/to/file.csv',
    row_count=10
WHERE id=42
```

### 6. User Checks Status

```typescript
// GET /api/jobs/42
{
  "success": true,
  "job": {
    "id": 42,
    "status": "completed",
    "listName": "Vol Flip - New",
    "resultFilePath": "/exports/2026-02-13/praxis-dev-Vol-Flip-New.csv",
    "rowCount": 10
  }
}
```

## Deployment Architecture

### Development (Current)

- **App:** PM2 on EC2
- **Worker:** PM2 on EC2
- **Database:** Local PostgreSQL
- **Storage:** Local filesystem

### Production (Planned)

- **App:** Vercel or Railway (auto-scaling)
- **Worker:** Railway or dedicated EC2
- **Database:** Neon or Supabase (managed PostgreSQL)
- **Storage:** AWS S3 (exported files)
- **CDN:** Cloudflare (global distribution)

## Scaling Strategy

### Horizontal Scaling

1. **Multiple Workers:** Spin up additional worker instances
   - Each polls the same database
   - `FOR UPDATE SKIP LOCKED` prevents race conditions
   - Process 3 jobs concurrently per worker

2. **Database Connection Pooling:**
   - Max 20 connections per app instance
   - Idle timeout: 30s
   - Connection timeout: 2s

3. **AI Agent Concurrency:**
   - Configurable: `MAX_CONCURRENT_JOBS = 3`
   - Each worker can run 3 agents simultaneously
   - 10 workers = 30 concurrent exports

### Vertical Scaling

- **App:** 2-4 CPU cores, 2-4GB RAM
- **Worker:** 2 CPU cores, 2GB RAM per instance
- **Database:** 2 CPU cores, 4GB RAM (can scale to 32GB+)

## Cost Estimate (Production)

### Infrastructure

| Service | Cost/Month |
|---------|-----------|
| Vercel (App) | $20-50 |
| Railway (Worker) | $20-30 |
| Neon DB | $25 |
| S3 Storage | $5-20 |
| **Total Infrastructure** | **$70-125** |

### Usage-Based (per 1000 exports)

| Item | Cost |
|------|------|
| AI Agents (Sonnet) | $50 |
| Database queries | $5 |
| Storage | $2 |
| **Total per 1000** | **$57** |

### Pricing Model

- **Tier 1:** $0.25/export (4.4x profit margin)
- **Tier 2:** $0.50/export (8.8x profit margin)
- **Enterprise:** $1000/mo unlimited (breakeven at ~1750 exports)

## Monitoring & Observability

### Metrics to Track

- Jobs pending/processing/completed/failed (per hour)
- Average job completion time
- Agent spawn success rate
- AI token usage and cost
- Database query performance
- Worker uptime and health

### Logging

- **App:** PM2 logs → `/home/ubuntu/.pm2/logs/propstream-app-*.log`
- **Worker:** PM2 logs → `/home/ubuntu/.pm2/logs/propstream-worker-*.log`
- **Database:** `job_logs` table for per-job audit trail

### Health Checks

```bash
# Check services
pm2 status

# Check database
psql -d propstream_app -c "SELECT COUNT(*) FROM export_jobs WHERE status='pending'"

# Check worker
curl http://localhost:18789/api/health  # If exposed
```

## Security Considerations

### 1. Database Security

- ✅ Separate app user (not postgres)
- ✅ Password authentication
- ⚠️  TODO: Encrypt `propstream_password_encrypted` field
- ⚠️  TODO: Row-level security for multi-tenant isolation

### 2. API Security

- ⚠️  TODO: Add authentication (JWT or session-based)
- ⚠️  TODO: Rate limiting per organization
- ⚠️  TODO: Input validation and sanitization

### 3. File Storage

- ✅ Organized by date and organization
- ⚠️  TODO: Move to S3 with presigned URLs
- ⚠️  TODO: Automatic cleanup of old exports (7-30 days)

## Development Commands

### Running Locally

```bash
# Start web app
cd ~/clawd/propstream-app
pm2 start "npm run dev" --name propstream-app

# Start worker
pm2 start "npm run worker" --name propstream-worker

# View logs
pm2 logs propstream-app
pm2 logs propstream-worker

# Restart services
pm2 restart all
```

### Database Management

```bash
# Connect to database
sudo -u postgres psql -d propstream_app

# Run migrations
cat db/schema.sql | sudo -u postgres psql -d propstream_app

# Backup database
sudo -u postgres pg_dump propstream_app > backup.sql

# Restore database
sudo -u postgres psql -d propstream_app < backup.sql
```

### Testing

```bash
# Create a test job
curl -X POST http://localhost:3000/api/export \
  -H "Content-Type: application/json" \
  -d '{"listName":"Vol Flip - New"}'

# Check job status
curl http://localhost:3000/api/jobs/1

# List recent jobs
curl http://localhost:3000/api/export
```

## Future Enhancements

### Phase 2 (Multi-tenant)

- [ ] User authentication (email + password)
- [ ] Organization management UI
- [ ] Per-org Propstream credentials vault
- [ ] Usage dashboard and billing

### Phase 3 (Advanced Features)

- [ ] Scheduled exports (daily/weekly)
- [ ] Webhook notifications on completion
- [ ] Custom filters and property criteria
- [ ] Bulk export multiple lists
- [ ] CSV transformation and enrichment

### Phase 4 (Enterprise)

- [ ] API-first architecture (public API)
- [ ] White-label deployment
- [ ] SSO integration (SAML, OAuth)
- [ ] Dedicated worker pools per org
- [ ] SLA guarantees and support

## Troubleshooting

### Worker Not Processing Jobs

```bash
# Check worker status
pm2 status propstream-worker

# Check logs
pm2 logs propstream-worker --lines 50

# Restart worker
pm2 restart propstream-worker
```

### Agent Spawn Failures

1. Check if Spike's heartbeat is running
2. Verify `/tmp/worker-spawn-request.json` is being deleted
3. Check Clawdbot gateway is running: `pm2 status clawdbot`

### Database Connection Issues

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U propstream_app_user -d propstream_app -h localhost

# Check connection pool
psql -d propstream_app -c "SELECT count(*) FROM pg_stat_activity WHERE datname='propstream_app'"
```

## Support

For issues or questions:
- Check logs: `pm2 logs`
- Review database: `psql -d propstream_app`
- Contact: Sky (sky@terrafeatures.com)
