#!/usr/bin/env node

/**
 * Agent Manager - Dedicated service for spawning and managing AI agents
 * 
 * Polls database for spawn requests every 1 second
 * Spawns agents via OpenClaw webhook API with Kimi model
 * Runs independently from main web app
 */

import DB from '../lib/db';

const POLL_INTERVAL_MS = 1000; // Check every 1 second for near-instant response
const MAX_CONCURRENT_AGENTS = 5; // Run up to 5 agents simultaneously

// OpenClaw webhook configuration
const OPENCLAW_GATEWAY_URL = process.env.CLAWDBOT_GATEWAY_URL || 'http://localhost:18789';
const OPENCLAW_HOOKS_TOKEN = process.env.OPENCLAW_HOOKS_TOKEN || 'praxis-hooks-secret-2026';
const DEFAULT_MODEL = 'nvidia/moonshotai/kimi-k2.5'; // Kimi - free via NVIDIA

class AgentManager {
  private activeAgents: Set<number> = new Set();
  private isShuttingDown = false;

  async start() {
    console.log('🤖 Agent Manager starting...');
    console.log(`📊 Max concurrent agents: ${MAX_CONCURRENT_AGENTS}`);
    console.log(`⏱️  Poll interval: ${POLL_INTERVAL_MS}ms`);
    console.log(`🔗 Gateway: ${OPENCLAW_GATEWAY_URL}`);
    console.log(`🧠 Default model: ${DEFAULT_MODEL}\n`);

    // Test database connection
    const healthy = await DB.healthCheck();
    if (!healthy) {
      console.error('❌ Database connection failed. Exiting.');
      process.exit(1);
    }

    console.log('✅ Database connected');
    console.log('🔍 Monitoring for spawn requests...\n');

    // Handle graceful shutdown
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));

    // Start polling loop
    this.pollLoop();
  }

  private async pollLoop() {
    while (!this.isShuttingDown) {
      try {
        await this.processNextRequest();
      } catch (error) {
        console.error('❌ Error in poll loop:', error);
      }

      // Wait before next poll
      await this.sleep(POLL_INTERVAL_MS);
    }
  }

  private async processNextRequest() {
    // Check if we can process more agents
    if (this.activeAgents.size >= MAX_CONCURRENT_AGENTS) {
      return;
    }

    // Check for request file
    const { existsSync, readFileSync, unlinkSync } = await import('fs');
    const requestFile = '/tmp/worker-spawn-request.json';

    if (!existsSync(requestFile)) {
      return; // No requests pending
    }

    try {
      const requestData = JSON.parse(readFileSync(requestFile, 'utf8'));
      const jobId = requestData.jobId;

      console.log(`📋 Processing spawn request for job #${jobId}`);

      // Mark as active
      this.activeAgents.add(jobId);

      // Delete request file immediately
      unlinkSync(requestFile);

      // Update job status to processing
      await DB.updateJobStatus(jobId, 'processing');
      await DB.addJobLog(jobId, 'info', 'Agent Manager picked up spawn request');

      // Execute agent task in background (don't await)
      this.executeAgent(requestData)
        .catch((error) => {
          console.error(`❌ Agent execution failed for job #${jobId}:`, error);
        })
        .finally(() => {
          this.activeAgents.delete(jobId);
        });

    } catch (error) {
      console.error('❌ Error processing spawn request:', error);
    }
  }

  private async executeAgent(requestData: any) {
    const jobId = requestData.jobId;
    const listName = requestData.listName || 'Vol Flip - New';
    const model = requestData.model || DEFAULT_MODEL;

    try {
      console.log(`🚀 Spawning agent for job #${jobId} via webhook...`);

      // Build the task prompt
      const task = this.buildTaskPrompt(jobId, listName);

      // Call OpenClaw webhook API directly
      const response = await this.callOpenClawWebhook(task, jobId, model);

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.error}`);
      }

      console.log(`✅ Agent spawned for job #${jobId}`);
      await DB.addJobLog(jobId, 'info', `Agent spawned via webhook (model: ${model})`);

      // The agent will update the database directly when complete
      // Webhook returns 202, agent runs asynchronously

    } catch (error: any) {
      console.error(`❌ Job #${jobId} spawn failed:`, error.message);

      await DB.incrementRetryCount(jobId);
      await DB.updateJobStatus(jobId, 'failed', {
        error_message: error.message
      });
      await DB.addJobLog(jobId, 'error', error.message);
    }
  }

  private buildTaskPrompt(jobId: number, listName: string): string {
    const today = new Date().toISOString().split('T')[0];
    
    return `Export properties from Propstream (Job #${jobId}).

## CRITICAL: Use JavaScript for UI interactions
Propstream uses custom checkboxes that don't appear in the accessibility tree. Use browser evaluate actions with JavaScript.

## Login Info
Email: master@praxisdatasystems.com
Password: Bturtle1517@@

## STEPS

### Step 1: Open the list directly
browser action="navigate" profile="openclaw" targetUrl="https://app.propstream.com/property/group/5137566"
Wait 3 seconds, then take a screenshot to verify the page loaded.

### Step 2: Handle any popups
If you see a login form, enter credentials and click Login.
If you see "Proceed" button (session conflict), click it.
If you see any modal with "Close" button, close it.
Take a screenshot after handling popups.

### Step 3: Select all properties using JavaScript
Use browser evaluate to click the select-all checkbox:
browser action="act" request={"kind": "evaluate", "fn": "document.querySelector('.src-app-Property-Group-style__GXX7w__selectHeader input')?.click()"}
Take a screenshot - you should see all checkboxes checked and "10 Selected" text.

### Step 4: Click Export using JavaScript
browser action="act" request={"kind": "evaluate", "fn": "Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Export'))?.click()"}
Take a screenshot - you should see "X Properties Exported" confirmation dialog.

### Step 5: Close the dialog and verify
Click the Close button on the confirmation dialog.
The export is complete on Propstream's side. Note: The file downloads as .xlsx format.

### Step 6: Update database as completed
Run: psql postgresql://propstream_app_user:dev_password_change_in_prod@localhost:5432/propstream_app -c "UPDATE export_jobs SET status='completed', completed_at=NOW() WHERE id=${jobId};"

Report "Export completed successfully for Job #${jobId}" when done.

## If Something Goes Wrong
Run: psql postgresql://propstream_app_user:dev_password_change_in_prod@localhost:5432/propstream_app -c "UPDATE export_jobs SET status='failed', error_message='<describe what went wrong>' WHERE id=${jobId};"`;
  }

  private async callOpenClawWebhook(task: string, jobId: number, model: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const url = `${OPENCLAW_GATEWAY_URL}/hooks/agent`;
      
      const payload = {
        message: task,
        name: `Propstream Export #${jobId}`,
        sessionKey: `propstream:export:job-${jobId}`,
        model: model,
        wakeMode: 'now',
        deliver: true,
        timeoutSeconds: 300 // 5 minute timeout
      };

      console.log(`📤 Calling webhook: ${url}`);
      console.log(`   Model: ${model}`);
      console.log(`   Session: ${payload.sessionKey}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENCLAW_HOOKS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 202) {
        console.log(`✅ Webhook accepted (202)`);
        return { ok: true };
      }

      const text = await response.text();
      console.error(`❌ Webhook failed: ${response.status} - ${text}`);
      return { ok: false, error: `HTTP ${response.status}: ${text}` };

    } catch (error: any) {
      console.error(`❌ Webhook error:`, error.message);
      return { ok: false, error: error.message };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async shutdown(signal: string) {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    this.isShuttingDown = true;

    // Wait for active agents to complete (with timeout)
    const maxWait = 60000; // 60 seconds
    const startTime = Date.now();

    while (this.activeAgents.size > 0 && (Date.now() - startTime) < maxWait) {
      console.log(`⏳ Waiting for ${this.activeAgents.size} active agent(s) to complete...`);
      await this.sleep(2000);
    }

    if (this.activeAgents.size > 0) {
      console.log(`⚠️  Forcefully shutting down with ${this.activeAgents.size} active agent(s)`);
    }

    console.log('👋 Agent Manager shut down');
    process.exit(0);
  }
}

// Start the agent manager
const manager = new AgentManager();
manager.start().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
