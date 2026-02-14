#!/usr/bin/env node

/**
 * Propstream Export Worker
 * 
 * This service runs 24/7 and:
 * 1. Polls the database for pending jobs
 * 2. Spawns Clawdbot agents to execute exports
 * 3. Monitors agent progress and updates job status
 * 4. Handles retries and error recovery
 */

import DB, { ExportJob } from '../lib/db';
import { readFileSync } from 'fs';
import { join } from 'path';

const POLL_INTERVAL_MS = 10000; // Check for jobs every 10 seconds
const MAX_CONCURRENT_JOBS = 3; // Process up to 3 jobs simultaneously

interface AgentSpawnResult {
  success: boolean;
  sessionKey?: string;
  error?: string;
}

class PropstreamWorker {
  private activeJobs: Set<number> = new Set();
  private isShuttingDown = false;

  async start() {
    console.log('🚀 Propstream Worker starting...');
    
    // Test database connection
    const healthy = await DB.healthCheck();
    if (!healthy) {
      console.error('❌ Database connection failed. Exiting.');
      process.exit(1);
    }

    console.log('✅ Database connected');
    console.log(`📊 Max concurrent jobs: ${MAX_CONCURRENT_JOBS}`);
    console.log(`⏱️  Poll interval: ${POLL_INTERVAL_MS}ms\n`);

    // Handle graceful shutdown
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));

    // Start polling loop
    this.pollLoop();
  }

  private async pollLoop() {
    while (!this.isShuttingDown) {
      try {
        await this.processNextJob();
      } catch (error) {
        console.error('❌ Error in poll loop:', error);
      }

      // Wait before next poll
      await this.sleep(POLL_INTERVAL_MS);
    }
  }

  private async processNextJob() {
    // Check if we can process more jobs
    if (this.activeJobs.size >= MAX_CONCURRENT_JOBS) {
      return;
    }

    // Get next pending job
    const job = await DB.getNextPendingJob();
    if (!job) {
      return; // No jobs pending
    }

    console.log(`📋 Processing job #${job.id}: "${job.list_name}"`);

    // Mark as active
    this.activeJobs.add(job.id);

    // Process job in background (don't await)
    this.executeJob(job)
      .catch((error) => {
        console.error(`❌ Job #${job.id} failed:`, error);
      })
      .finally(() => {
        this.activeJobs.delete(job.id);
      });
  }

  private async executeJob(job: ExportJob) {
    try {
      // Update status to processing
      await DB.updateJobStatus(job.id, 'processing');
      await DB.addJobLog(job.id, 'info', 'Job started - spawning AI agent');

      // Get organization credentials
      const org = await DB.getOrganization(job.organization_id);
      if (!org) {
        throw new Error(`Organization ${job.organization_id} not found`);
      }

      // Spawn Clawdbot agent
      const spawnResult = await this.spawnExportAgent(job, org.slug);

      if (!spawnResult.success) {
        throw new Error(spawnResult.error || 'Failed to spawn agent');
      }

      // Update job with agent session key
      await DB.updateJobStatus(job.id, 'processing', {
        agent_session_key: spawnResult.sessionKey
      });

      await DB.addJobLog(
        job.id,
        'info',
        `Agent spawned: ${spawnResult.sessionKey}`
      );

      // Monitor agent progress (in background)
      this.monitorAgentProgress(job.id, spawnResult.sessionKey!);

    } catch (error: any) {
      console.error(`❌ Job #${job.id} execution failed:`, error.message);

      await DB.incrementRetryCount(job.id);
      await DB.updateJobStatus(job.id, 'failed', {
        error_message: error.message
      });
      await DB.addJobLog(job.id, 'error', error.message);
    }
  }

  private async spawnExportAgent(
    job: ExportJob,
    orgSlug: string
  ): Promise<AgentSpawnResult> {
    const today = new Date().toISOString().split('T')[0];
    const outputPath = join(
      process.env.EXPORT_FILES_PATH || '/home/ubuntu/clawd/propstream-exports',
      today,
      `${orgSlug}-${job.list_name.replace(/\s+/g, '-')}.csv`
    );

    const task = `Export today's new properties from Propstream's "${job.list_name}" automated list.

**IMPORTANT - Browser Automation:**
- You have access to the \`browser\` tool - USE IT for all web navigation
- DO NOT use \`exec\` or \`xdg-open\` to open browsers
- **CRITICAL: Add profile="clawd" target="host" to EVERY browser call**
- Open browser: \`browser\` action="open" profile="clawd" target="host" targetUrl="https://app.propstream.com"
- Take snapshots: \`browser\` action="snapshot" profile="clawd" target="host"
- Click elements: \`browser\` action="act" profile="clawd" target="host" request={{kind:"click", ref:"e123"}}
- Type text: \`browser\` action="act" profile="clawd" target="host" request={{kind:"type", ref:"e123", text:"value"}}

**Navigation Steps:**

1. **FIRST:** Use the \`read\` tool to read ~/clawd/credentials/propstream-praxis.json - get the actual email and password
2. Login to https://app.propstream.com using the email and password from step 1 (DO NOT make up credentials)
2. If popup about existing session appears → Click "Proceed"
3. If full-screen updates popup appears → Click "Close"
4. Click "My Properties" tab (house icon on left)
5. Under "Automated Lists" section → Click "${job.list_name}"
6. In the table, check "Date Added to List" column (second to last)
7. Select ONLY rows where date = TODAY (${new Date().toISOString().split('T')[0]})
8. Click "Actions" dropdown → Click "Export CSV"
9. Wait 10 seconds for download to complete
10. Find the downloaded CSV: \`find ~/Downloads -name "*.csv" -mmin -1 -type f | head -1\`
11. Copy it to: ${outputPath}
12. Count rows: \`wc -l < ${outputPath}\` (subtract 1 for header)
13. After successful export, run:
    psql -d propstream_app -c "UPDATE export_jobs SET status='completed', completed_at=CURRENT_TIMESTAMP, result_file_path='${outputPath}', row_count=<actual_count> WHERE id=${job.id}"

**Job ID:** ${job.id}
**Critical:** Only export TODAY's properties, not the entire list.

Full instructions: ~/clawd/credentials/propstream-navigation.md`;

    try {
      // Write spawn request file for Spike to pick up via heartbeat
      const requestFile = '/tmp/worker-spawn-request.json';
      const { writeFileSync } = await import('fs');
      
      writeFileSync(requestFile, JSON.stringify({
        jobId: job.id,
        task,
        label: `propstream-job-${job.id}`,
        model: 'nvidia/moonshotai/kimi-k2.5',
        outputPath,
        timestamp: Date.now()
      }, null, 2));

      console.log(`📝 Spawn request written for job #${job.id}`);

      // Wait a bit for Spike to pick it up
      await this.sleep(5000);

      // Check if request was picked up (file should be deleted)
      const { existsSync } = await import('fs');
      if (!existsSync(requestFile)) {
        // Request was picked up, return a temporary session key
        return {
          success: true,
          sessionKey: `pending-${job.id}`
        };
      } else {
        return {
          success: false,
          error: 'Spawn request not picked up by agent coordinator'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to create spawn request: ${error.message}`
      };
    }
  }

  private async monitorAgentProgress(jobId: number, sessionKey: string) {
    // Poll agent status every 30 seconds for up to 10 minutes
    const maxChecks = 20;
    let checks = 0;

    while (checks < maxChecks) {
      await this.sleep(30000); // Wait 30 seconds
      checks++;

      try {
        // Check if agent has completed by looking at session messages
        // For now, we'll use a simple timeout-based approach
        // In production, you'd implement proper agent status checking

        const job = await DB.getJob(jobId);
        if (!job || job.status !== 'processing') {
          break; // Job already completed or failed
        }

        // Check if export file exists
        const fileExists = await this.checkExportFileExists(jobId);
        if (fileExists) {
          console.log(`✅ Job #${jobId} completed successfully`);
          await this.markJobCompleted(jobId);
          break;
        }

      } catch (error) {
        console.error(`Error monitoring job #${jobId}:`, error);
      }
    }

    // If we exhausted checks and job is still processing, mark as failed
    const job = await DB.getJob(jobId);
    if (job && job.status === 'processing') {
      console.log(`⏱️ Job #${jobId} timed out after ${maxChecks * 30}s`);
      await DB.updateJobStatus(jobId, 'failed', {
        error_message: 'Job timed out - agent did not complete within expected time'
      });
      await DB.addJobLog(jobId, 'error', 'Job timed out');
    }
  }

  private async checkExportFileExists(jobId: number): Promise<boolean> {
    // Check if the export file was created
    // This is a placeholder - implement actual file checking logic
    return false;
  }

  private async markJobCompleted(jobId: number) {
    // Update job status and extract metrics
    // This is a placeholder - implement actual completion logic
    await DB.updateJobStatus(jobId, 'completed', {
      result_file_path: '/path/to/file.csv',
      row_count: 10
    });
    await DB.addJobLog(jobId, 'info', 'Job completed successfully');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async shutdown(signal: string) {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    this.isShuttingDown = true;

    // Wait for active jobs to complete (with timeout)
    const maxWait = 60000; // 60 seconds
    const startTime = Date.now();

    while (this.activeJobs.size > 0 && (Date.now() - startTime) < maxWait) {
      console.log(`⏳ Waiting for ${this.activeJobs.size} active job(s) to complete...`);
      await this.sleep(2000);
    }

    if (this.activeJobs.size > 0) {
      console.log(`⚠️  Forcefully shutting down with ${this.activeJobs.size} active job(s)`);
    }

    console.log('👋 Worker shut down');
    process.exit(0);
  }
}

// Start the worker
const worker = new PropstreamWorker();
worker.start().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
