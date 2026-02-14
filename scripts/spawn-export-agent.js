#!/usr/bin/env node

/**
 * Spawn a Propstream export sub-agent
 * Called by the web app's /api/export endpoint
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const GATEWAY_TOKEN = '5528d70a86fe853ff3a4f1f648716cbb6004b583153c581a';

const today = new Date().toISOString().split('T')[0];
const outputPath = `/home/ubuntu/clawd/propstream-exports/${today}/Vol-Flip-New.csv`;

// Update status immediately
const statusFile = '/tmp/propstream-export-status.json';
fs.writeFileSync(statusFile, JSON.stringify({
  running: true,
  timestamp: Date.now(),
  message: 'Spawning sub-agent...'
}, null, 2));

const task = `Export today's new properties from Propstream's "Vol Flip - New" automated list.

**Navigation Steps:**

1. Login to https://app.propstream.com (credentials: ~/clawd/credentials/propstream-praxis.json)
2. If popup about existing session appears → Click "Proceed"
3. If full-screen updates popup appears → Click "Close"
4. Click "My Properties" tab (house icon on left)
5. Under "Automated Lists" section → Click "Vol Flip - New"
6. In the table, check "Date Added to List" column (second to last)
7. Select ONLY rows where date = TODAY (${today})
8. Click "Actions" dropdown → Click "Export CSV"
9. Save file to: ${outputPath}
10. After successful export, update /tmp/propstream-export-status.json:
    {
      "running": false,
      "timestamp": <current_timestamp_ms>,
      "success": true,
      "message": "Export complete",
      "file": "${outputPath}",
      "rows": <row_count>
    }

**Critical:** Only export TODAY's properties, not the entire list.

Full instructions: ~/clawd/credentials/propstream-navigation.md

If the export fails, update the status file with success: false and error message.`;

// Send spawn request to Spike's session
const spawnRequest = JSON.stringify({
  message: `🔧 **WEB APP EXPORT REQUEST**\n\nPlease spawn a sub-agent with this task:\n\n${task}`,
  sessionKey: 'agent:main:main'
});

const options = {
  hostname: 'localhost',
  port: 18789,
  path: '/api/sessions/send',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${GATEWAY_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(spawnRequest)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log(JSON.stringify({ success: true, message: 'Spawn request sent to Spike' }));
    } else {
      console.error(JSON.stringify({ success: false, error: `HTTP ${res.statusCode}: ${data}` }));
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error(JSON.stringify({ success: false, error: error.message }));
  process.exit(1);
});

req.write(spawnRequest);
req.end();
