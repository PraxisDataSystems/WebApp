import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'data', 'config.json');
const DEFAULT_CONFIG_PATH = path.join(process.cwd(), 'data', 'default-config.json');

export async function GET() {
  try {
    let config;
    
    if (fs.existsSync(CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    } else {
      config = JSON.parse(fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf-8'));
    }

    return NextResponse.json({
      success: true,
      config
    });
  } catch (error: any) {
    console.error('Config GET error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { config } = await request.json();

    if (!config) {
      return NextResponse.json({
        success: false,
        error: 'Missing config data'
      }, { status: 400 });
    }

    // Validate config structure
    if (!config.prompts || !config.thresholds || !config.messageTemplates) {
      return NextResponse.json({
        success: false,
        error: 'Invalid config structure'
      }, { status: 400 });
    }

    // Save configuration
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

    return NextResponse.json({
      success: true,
      message: 'Configuration saved successfully'
    });
  } catch (error: any) {
    console.error('Config POST error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  // Reset to default configuration
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      fs.unlinkSync(CONFIG_PATH);
    }

    const defaultConfig = JSON.parse(fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf-8'));

    return NextResponse.json({
      success: true,
      message: 'Configuration reset to defaults',
      config: defaultConfig
    });
  } catch (error: any) {
    console.error('Config PUT error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
