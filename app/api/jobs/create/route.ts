import { NextRequest, NextResponse } from 'next/server';
import DB from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { listName, organizationId, userId, priority } = body;

    if (!listName) {
      return NextResponse.json(
        { success: false, error: 'listName is required' },
        { status: 400 }
      );
    }

    // Use default org if not specified (for development)
    const orgId = organizationId || parseInt(process.env.DEFAULT_ORG_ID || '1');

    // Create job in database
    const job = await DB.createJob(orgId, listName, userId, priority || 0);

    await DB.addJobLog(job.id, 'info', `Job created for list: ${listName}`);

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        listName: job.list_name,
        createdAt: job.created_at
      }
    });
  } catch (error: any) {
    console.error('Create job error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
