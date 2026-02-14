import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync } from 'fs';
import DB from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { listName = 'Vol Flip - New', organizationId, userId, model } = body;

    // Use default org if not specified (for development)
    const orgId = organizationId || parseInt(process.env.DEFAULT_ORG_ID || '1');

    // Create job in database
    const job = await DB.createJob(orgId, listName, userId);

    await DB.addJobLog(job.id, 'info', `Export requested via web app`);

    // Create spawn request file for agent-manager to pick up
    const spawnRequest = {
      jobId: job.id,
      listName: listName,
      model: model || 'nvidia/moonshotai/kimi-k2.5', // Default to Kimi
      timestamp: Date.now()
    };

    writeFileSync('/tmp/worker-spawn-request.json', JSON.stringify(spawnRequest, null, 2));

    console.log(`✅ Job #${job.id} created, spawn request written for list: ${listName}`);

    return NextResponse.json({
      success: true,
      message: 'Export job created. Agent will start within 1-2 seconds.',
      job: {
        id: job.id,
        status: job.status,
        listName: job.list_name
      }
    });
  } catch (error: any) {
    console.error('Export API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get recent jobs for the default organization
    const orgId = parseInt(process.env.DEFAULT_ORG_ID || '1');
    
    const result = await DB.query(
      `SELECT id, list_name, status, created_at, completed_at, row_count, error_message
       FROM export_jobs
       WHERE organization_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [orgId]
    );

    return NextResponse.json({
      success: true,
      jobs: result.rows
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
