import * as fs from 'fs';
import * as path from 'path';
import https from 'https';
import { EvaluatedProperty } from './evaluation-engine';

const CREDENTIALS_DIR = path.join(process.env.HOME!, 'clawd', 'credentials');
const CLIENT_SECRET_PATH = path.join(CREDENTIALS_DIR, 'google-oauth-client.json');
const TOKEN_PATH = path.join(CREDENTIALS_DIR, 'google-token.json');

interface GoogleCredentials {
  installed: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

export class SheetsIntegration {
  private credentials: GoogleCredentials;
  private tokens: GoogleTokens;
  private spreadsheetId: string;

  constructor(spreadsheetId: string) {
    this.spreadsheetId = spreadsheetId;
    
    const credData = fs.readFileSync(CLIENT_SECRET_PATH, 'utf8');
    this.credentials = JSON.parse(credData);
    
    const tokenData = fs.readFileSync(TOKEN_PATH, 'utf8');
    this.tokens = JSON.parse(tokenData);
  }

  private async apiRequest(endpoint: string, method: string = 'GET', body: any = null): Promise<any> {
    const headers: any = {
      'Authorization': `Bearer ${this.tokens.access_token}`,
      'Content-Type': 'application/json'
    };

    if (body) {
      body = JSON.stringify(body);
      headers['Content-Length'] = Buffer.byteLength(body);
    }

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'sheets.googleapis.com',
        path: endpoint,
        method,
        headers
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  async getSheetStructure(): Promise<any> {
    return this.apiRequest(`/v4/spreadsheets/${this.spreadsheetId}`);
  }

  async getCurrentData(range: string = 'Sheet1'): Promise<any[][]> {
    const response = await this.apiRequest(
      `/v4/spreadsheets/${this.spreadsheetId}/values/${encodeURIComponent(range)}`
    );
    return response.values || [];
  }

  async appendProperties(properties: EvaluatedProperty[], sheetName: string = 'Sheet1'): Promise<void> {
    // Get existing data to match column structure
    const existingData = await this.getCurrentData(sheetName);
    const headers = existingData[0] || [];

    // Map properties to match existing columns
    const rows = properties.map(prop => this.mapPropertyToRow(prop, headers));

    // Append to sheet
    await this.apiRequest(
      `/v4/spreadsheets/${this.spreadsheetId}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED`,
      'POST',
      { values: rows }
    );

    console.log(`✓ Appended ${properties.length} properties to Google Sheets`);
  }

  private mapPropertyToRow(property: EvaluatedProperty, headers: string[]): any[] {
    // Create a mapping of common field names
    const fieldMap: { [key: string]: any } = {
      'Address': property.address,
      'City': property.city,
      'State': property.state,
      'ZIP': property.zip,
      'Bedrooms': property.bedrooms,
      'Bathrooms': property.bathrooms,
      'Square Feet': property.sqft,
      'Year Built': property.yearBuilt,
      'Current Value': property.currentValue,
      'ARV': property.arv,
      'Cash Offer': property.cashOffer,
      'Wholesale Price': property.wholesalePrice,
      'ARV Spread %': property.arvSpread.toFixed(2),
      'LTV %': property.ltv.toFixed(2),
      'Strategy': property.strategy,
      'Financing': property.financing,
      'Context Notes': property.contextNotes,
      'Outreach Message': property.outreachMessage,
      'Search Name': property.searchName,
      'Evaluated Date': property.evaluatedAt,
      'Owner Name': property.ownerName,
      'Owner Phone': property.ownerPhone,
      'Loan Amount': property.loanAmount,
      'Estimated Equity': property.estimatedEquity
    };

    // If no headers, return default order
    if (headers.length === 0) {
      return [
        property.address,
        property.city,
        property.state,
        property.zip,
        property.bedrooms,
        property.bathrooms,
        property.sqft,
        property.yearBuilt,
        property.currentValue,
        property.arv,
        property.cashOffer,
        property.wholesalePrice,
        property.arvSpread.toFixed(2),
        property.ltv.toFixed(2),
        property.strategy,
        property.financing,
        property.contextNotes,
        property.outreachMessage,
        property.searchName,
        property.evaluatedAt
      ];
    }

    // Match existing column structure
    return headers.map(header => {
      const normalizedHeader = header.trim();
      return fieldMap[normalizedHeader] !== undefined ? fieldMap[normalizedHeader] : '';
    });
  }

  async updateProperty(rowIndex: number, property: EvaluatedProperty, sheetName: string = 'Sheet1'): Promise<void> {
    const existingData = await this.getCurrentData(sheetName);
    const headers = existingData[0] || [];
    const row = this.mapPropertyToRow(property, headers);

    const range = `${sheetName}!A${rowIndex + 1}:${String.fromCharCode(65 + headers.length - 1)}${rowIndex + 1}`;

    await this.apiRequest(
      `/v4/spreadsheets/${this.spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      'PUT',
      { values: [row] }
    );

    console.log(`✓ Updated row ${rowIndex + 1} in Google Sheets`);
  }
}
