import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REQUEST_FILE = '/tmp/propstream-export-request.json';
const STATUS_FILE = '/tmp/propstream-export-status.json';

export interface ExportRequest {
  timestamp: number;
  list: string;
  outputPath: string;
}

export interface ExportStatus {
  running: boolean;
  timestamp: number;
  success?: boolean;
  message?: string;
  file?: string;
  rows?: number;
  error?: string;
}

export class SpawnHelper {
  static requestExport(list: string = 'Vol Flip - New'): void {
    const today = new Date().toISOString().split('T')[0];
    const request: ExportRequest = {
      timestamp: Date.now(),
      list,
      outputPath: join(process.env.HOME!, 'clawd', 'propstream-exports', today, 'Vol-Flip-New.csv')
    };
    
    writeFileSync(REQUEST_FILE, JSON.stringify(request, null, 2));
    
    // Initialize status
    const status: ExportStatus = {
      running: true,
      timestamp: Date.now()
    };
    writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
  }
  
  static getStatus(): ExportStatus | null {
    if (!existsSync(STATUS_FILE)) {
      return null;
    }
    
    try {
      const data = readFileSync(STATUS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  
  static clearRequest(): void {
    if (existsSync(REQUEST_FILE)) {
      require('fs').unlinkSync(REQUEST_FILE);
    }
  }
}
