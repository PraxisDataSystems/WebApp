'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText, Upload, CheckCircle, AlertCircle } from 'lucide-react';

export default function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [exportedFiles, setExportedFiles] = useState<string[]>([]);
  const [evaluatedData, setEvaluatedData] = useState<any>(null);

  async function handleExport() {
    setLoading(true);
    setStatus('Creating export job...');
    
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      
      if (data.success && data.job) {
        setStatus(`✓ Export job #${data.job.id} created! Worker will process it shortly.`);
        // Optionally poll for completion
        pollJobStatus(data.job.id);
      } else {
        setStatus(`✗ Export failed: ${data.error}`);
      }
    } catch (error: any) {
      setStatus(`✗ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function pollJobStatus(jobId: number) {
    // Poll every 5 seconds for job completion
    const maxAttempts = 24; // 2 minutes total
    let attempts = 0;

    const poll = setInterval(async () => {
      attempts++;
      
      try {
        const response = await fetch('/api/export');
        const data = await response.json();
        
        if (data.success && data.jobs) {
          const job = data.jobs.find((j: any) => j.id === jobId);
          
          if (job) {
            if (job.status === 'completed') {
              setStatus(`✓ Export completed! ${job.row_count} properties exported.`);
              if (job.result_file_path) {
                setExportedFiles([job.result_file_path]);
              }
              clearInterval(poll);
            } else if (job.status === 'failed') {
              setStatus(`✗ Export failed: ${job.error_message || 'Unknown error'}`);
              clearInterval(poll);
            } else {
              setStatus(`⏳ Job #${jobId} status: ${job.status}...`);
            }
          }
        }
      } catch (error) {
        console.error('Poll error:', error);
      }

      if (attempts >= maxAttempts) {
        setStatus(`⏱️ Job #${jobId} is taking longer than expected. Check back later.`);
        clearInterval(poll);
      }
    }, 5000);
  }

  async function handleEvaluate() {
    if (exportedFiles.length === 0) {
      setStatus('No exported files to evaluate. Export first!');
      return;
    }

    setLoading(true);
    setStatus('Evaluating properties with AI...');

    try {
      // Evaluate the first exported file for testing
      const filePath = exportedFiles[0];
      const searchName = filePath.split('/').pop()?.replace('.csv', '') || 'search';

      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, searchName })
      });

      const data = await response.json();

      if (data.success) {
        setEvaluatedData(data);
        setStatus(`✓ Evaluated ${data.count} properties successfully!`);
      } else {
        setStatus(`✗ Evaluation failed: ${data.error}`);
      }
    } catch (error: any) {
      setStatus(`✗ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handlePushToSheets() {
    if (!evaluatedData) {
      setStatus('No evaluated data to push. Evaluate properties first!');
      return;
    }

    setLoading(true);
    setStatus('Pushing to Google Sheets...');

    try {
      const response = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluatedFile: evaluatedData.savedTo })
      });

      const data = await response.json();

      if (data.success) {
        setStatus(`✓ Pushed ${data.count} properties to Google Sheets!`);
      } else {
        setStatus(`✗ Push failed: ${data.error}`);
      }
    } catch (error: any) {
      setStatus(`✗ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Automated real estate wholesaling pipeline
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              1. Export
            </CardTitle>
            <CardDescription>
              Pull properties from Propstream saved searches
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleExport} 
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Exporting...' : 'Export from Propstream'}
            </Button>
            {exportedFiles.length > 0 && (
              <div className="mt-4 text-sm">
                <p className="font-medium mb-1">Exported files:</p>
                <ul className="space-y-1">
                  {exportedFiles.map((file, i) => (
                    <li key={i} className="text-muted-foreground truncate">
                      • {file.split('/').pop()}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              2. Evaluate
            </CardTitle>
            <CardDescription>
              AI-powered property analysis and routing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleEvaluate} 
              disabled={loading || exportedFiles.length === 0}
              className="w-full"
            >
              {loading ? 'Evaluating...' : 'Evaluate Properties'}
            </Button>
            {evaluatedData && (
              <div className="mt-4">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>{evaluatedData.count} properties evaluated</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              3. Push to Sheets
            </CardTitle>
            <CardDescription>
              Export evaluated data to Google Sheets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handlePushToSheets} 
              disabled={loading || !evaluatedData}
              className="w-full"
            >
              {loading ? 'Pushing...' : 'Push to Sheets'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {status && (
        <Card className={status.includes('✗') ? 'border-destructive' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              {status.includes('✓') ? (
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              ) : status.includes('✗') ? (
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              ) : (
                <div className="h-5 w-5 mt-0.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              )}
              <p className="text-sm">{status}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Quick Start</CardTitle>
          <CardDescription>Follow these steps to process properties</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">1</div>
            <div>
              <p className="font-medium">Export Saved Searches</p>
              <p className="text-muted-foreground">Click "Export from Propstream" to pull properties from your saved searches (max 5 per search for testing)</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">2</div>
            <div>
              <p className="font-medium">Evaluate with AI</p>
              <p className="text-muted-foreground">AI analyzes each property to calculate ARV, cash offers, and routing strategy</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">3</div>
            <div>
              <p className="font-medium">Push to Google Sheets</p>
              <p className="text-muted-foreground">Export evaluated properties to your tracking spreadsheet for outreach</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
