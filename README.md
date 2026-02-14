# Propstream Export Manager

Web app for managing automated Propstream property list exports.

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Database:** PostgreSQL (can use Supabase for cloud)
- **Styling:** Tailwind CSS
- **Browser Automation:** OpenClaw (for Propstream login/export)

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Create `.env.local`:
```env
# Database (local PostgreSQL or Supabase)
DATABASE_URL=postgresql://user:password@localhost:5432/propstream_app

# OpenClaw webhook (for triggering exports)
OPENCLAW_GATEWAY_URL=http://localhost:9315
OPENCLAW_HOOKS_TOKEN=your-secret-token
```

### 3. Database Setup
```bash
# Create database
createdb propstream_app

# Run migrations (uses Drizzle)
npm run db:push
```

### 4. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Features
- View Propstream property lists
- Trigger exports with one click
- Track export job status
- Download exported files

## Propstream Credentials
Store in a secure location (not in repo):
- Email: your-propstream-email
- Password: your-propstream-password

## Architecture
- `/app` - Next.js pages and API routes
- `/components` - React components
- `/lib` - Database and utilities
- `/agent-manager` - Export automation logic

## Browser Automation
The actual Propstream export is handled by an AI agent via OpenClaw:
1. Web app triggers export via webhook
2. Agent logs into Propstream
3. Agent navigates to list and clicks Export
4. Downloaded file is saved to exports folder
