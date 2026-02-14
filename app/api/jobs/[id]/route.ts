import { NextRequest, NextResponse } from 'next/server';
import DB from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = parseInt(params.id);

    if (isNaN(jobId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    const job = await DB.getJob(jobId);

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // Get logs if requested
    const includeLogs = request.nextUrl.searchParams.get('logs') === 'true';
    const logs = includeLogs ? await DB.getJobLogs(jobId) : [];

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        listName: job.list_name,
        createdAt: job.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        resultFilePath: job.result_file_path,
        rowCount: job.row_count,
        errorMessage: job.error_message,
        retryCount: job.retry_count
      },
      logs: logs.length > 0 ? logs : undefined
    });
  } catch (error: any) {
    console.error('Get job error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
