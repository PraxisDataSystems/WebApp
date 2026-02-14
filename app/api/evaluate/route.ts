import { NextRequest, NextResponse } from 'next/server';
import { EvaluationEngine } from '@/lib/evaluation-engine';
import * as fs from 'fs';
import * as path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { filePath, searchName } = await request.json();

    if (!filePath || !searchName) {
      return NextResponse.json({
        success: false,
        error: 'Missing filePath or searchName'
      }, { status: 400 });
    }

    // Load configuration
    const configPath = path.join(process.cwd(), 'data', 'config.json');
    const defaultConfigPath = path.join(process.cwd(), 'data', 'default-config.json');
    
    let config;
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } else {
      config = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf-8'));
    }

    // Get OpenAI API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'OPENAI_API_KEY not configured'
      }, { status: 500 });
    }

    const engine = new EvaluationEngine(apiKey, config);
    const evaluatedProperties = await engine.evaluateCSV(filePath, searchName);

    // Save evaluated data
    const evalDir = path.join(process.env.HOME!, 'clawd', 'propstream-exports', 'evaluated');
    if (!fs.existsSync(evalDir)) {
      fs.mkdirSync(evalDir, { recursive: true });
    }

    const evalFilePath = path.join(evalDir, `${searchName}-evaluated.json`);
    fs.writeFileSync(evalFilePath, JSON.stringify(evaluatedProperties, null, 2));

    return NextResponse.json({
      success: true,
      properties: evaluatedProperties,
      count: evaluatedProperties.length,
      savedTo: evalFilePath
    });
  } catch (error: any) {
    console.error('Evaluation API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET() {
  // List available CSV files for evaluation
  const exportsDir = path.join(process.env.HOME!, 'clawd', 'propstream-exports');
  
  if (!fs.existsSync(exportsDir)) {
    return NextResponse.json({ files: [] });
  }

  const dates = fs.readdirSync(exportsDir).filter(f => 
    fs.statSync(path.join(exportsDir, f)).isDirectory()
  );

  const files: any[] = [];
  dates.forEach(date => {
    const dateDir = path.join(exportsDir, date);
    const csvFiles = fs.readdirSync(dateDir).filter(f => f.endsWith('.csv'));
    
    csvFiles.forEach(file => {
      files.push({
        date,
        filename: file,
        path: path.join(dateDir, file),
        searchName: file.replace('.csv', '').replace(/-/g, ' ')
      });
    });
  });

  return NextResponse.json({ files });
}
