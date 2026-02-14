import { NextRequest, NextResponse } from 'next/server';
import { SheetsIntegration } from '@/lib/sheets-integration';
import * as fs from 'fs';
import * as path from 'path';

const SPREADSHEET_ID = '1TMEYZ9RjTBNBS4lqDGxX4lDdh-OReMGX_0uiXuNNjv0';

export async function POST(request: NextRequest) {
  try {
    const { evaluatedFile, sheetName = 'Sheet1' } = await request.json();

    if (!evaluatedFile) {
      return NextResponse.json({
        success: false,
        error: 'Missing evaluatedFile path'
      }, { status: 400 });
    }

    // Load evaluated properties
    const properties = JSON.parse(fs.readFileSync(evaluatedFile, 'utf-8'));

    // Push to Google Sheets
    const sheets = new SheetsIntegration(SPREADSHEET_ID);
    await sheets.appendProperties(properties, sheetName);

    return NextResponse.json({
      success: true,
      count: properties.length,
      message: `Successfully pushed ${properties.length} properties to Google Sheets`
    });
  } catch (error: any) {
    console.error('Sheets API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const sheets = new SheetsIntegration(SPREADSHEET_ID);
    const structure = await sheets.getSheetStructure();
    const data = await sheets.getCurrentData('Sheet1');

    return NextResponse.json({
      success: true,
      spreadsheetId: SPREADSHEET_ID,
      title: structure.properties?.title,
      sheetCount: structure.sheets?.length,
      rowCount: data.length,
      headers: data[0] || []
    });
  } catch (error: any) {
    console.error('Sheets API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
