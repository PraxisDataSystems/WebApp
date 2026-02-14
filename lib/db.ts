import { Pool, PoolClient, QueryResult } from 'pg';

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.on('connect', () => {
  console.log('✅ Database connected');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
});

export interface ExportJob {
  id: number;
  organization_id: number;
  user_id?: number;
  list_name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  started_at?: Date;
  completed_at?: Date;
  agent_session_key?: string;
  result_file_path?: string;
  row_count?: number;
  error_message?: string;
  retry_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface Organization {
  id: number;
  name: string;
  slug: string;
  propstream_email?: string;
  propstream_password_encrypted?: string;
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
}

// Database utilities
export class DB {
  static async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    return pool.query(text, params);
  }

  static async getClient(): Promise<PoolClient> {
    return pool.connect();
  }

  // Job management
  static async createJob(
    organizationId: number,
    listName: string,
    userId?: number,
    priority: number = 0
  ): Promise<ExportJob> {
    const result = await this.query<ExportJob>(
      `INSERT INTO export_jobs (organization_id, user_id, list_name, priority, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [organizationId, userId, listName, priority]
    );
    return result.rows[0];
  }

  static async getJob(jobId: number): Promise<ExportJob | null> {
    const result = await this.query<ExportJob>(
      'SELECT * FROM export_jobs WHERE id = $1',
      [jobId]
    );
    return result.rows[0] || null;
  }

  static async getNextPendingJob(): Promise<ExportJob | null> {
    const result = await this.query<ExportJob>(
      `SELECT * FROM export_jobs
       WHERE status = 'pending' AND retry_count < 3
       ORDER BY priority DESC, created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`
    );
    return result.rows[0] || null;
  }

  static async updateJobStatus(
    jobId: number,
    status: ExportJob['status'],
    updates: Partial<ExportJob> = {}
  ): Promise<void> {
    const fields = ['status = $2'];
    const values: any[] = [jobId, status];
    let paramIndex = 3;

    if (updates.agent_session_key) {
      fields.push(`agent_session_key = $${paramIndex++}`);
      values.push(updates.agent_session_key);
    }

    if (updates.result_file_path) {
      fields.push(`result_file_path = $${paramIndex++}`);
      values.push(updates.result_file_path);
    }

    if (updates.row_count !== undefined) {
      fields.push(`row_count = $${paramIndex++}`);
      values.push(updates.row_count);
    }

    if (updates.error_message) {
      fields.push(`error_message = $${paramIndex++}`);
      values.push(updates.error_message);
    }

    if (status === 'processing') {
      fields.push(`started_at = CURRENT_TIMESTAMP`);
    }

    if (status === 'completed' || status === 'failed') {
      fields.push(`completed_at = CURRENT_TIMESTAMP`);
    }

    await this.query(
      `UPDATE export_jobs SET ${fields.join(', ')} WHERE id = $1`,
      values
    );
  }

  static async incrementRetryCount(jobId: number): Promise<void> {
    await this.query(
      'UPDATE export_jobs SET retry_count = retry_count + 1 WHERE id = $1',
      [jobId]
    );
  }

  static async addJobLog(
    jobId: number,
    level: 'info' | 'warning' | 'error',
    message: string
  ): Promise<void> {
    await this.query(
      'INSERT INTO job_logs (job_id, level, message) VALUES ($1, $2, $3)',
      [jobId, level, message]
    );
  }

  static async getJobLogs(jobId: number, limit: number = 50): Promise<any[]> {
    const result = await this.query(
      'SELECT * FROM job_logs WHERE job_id = $1 ORDER BY created_at DESC LIMIT $2',
      [jobId, limit]
    );
    return result.rows;
  }

  static async getOrganization(orgId: number): Promise<Organization | null> {
    const result = await this.query<Organization>(
      'SELECT * FROM organizations WHERE id = $1',
      [orgId]
    );
    return result.rows[0] || null;
  }

  static async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    const result = await this.query<Organization>(
      'SELECT * FROM organizations WHERE slug = $1',
      [slug]
    );
    return result.rows[0] || null;
  }

  // Health check
  static async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }
}

export default DB;
