import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
// OpenAI import removed for Vercel compatibility - evaluation runs server-side

export interface Property {
  // Raw Propstream data
  address: string;
  city: string;
  state: string;
  zip: string;
  currentValue: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  yearBuilt: number;
  loanAmount?: number;
  estimatedEquity?: number;
  ownerName?: string;
  ownerPhone?: string;
  [key: string]: any; // Allow additional fields
}

export interface EvaluatedProperty extends Property {
  // Calculated fields
  arv: number;
  cashOffer: number;
  wholesalePrice: number;
  arvSpread: number;
  ltv: number;
  
  // Routing
  strategy: 'Fix & Flip' | 'Turnkey' | 'Wholesale';
  financing: 'Cash Offer' | 'Seller Financing' | 'Subject To';
  
  // AI-generated
  contextNotes: string;
  outreachMessage: string;
  
  // Metadata
  searchName: string;
  evaluatedAt: string;
}

export interface EvaluationConfig {
  prompts: { [searchType: string]: string };
  thresholds: {
    arvSpreadMin: number;
    ltvMax: number;
    wholesaleMargin: number;
  };
  messageTemplates: {
    cashOffer: string;
    sellerFinancing: string;
    subjectTo: string;
  };
}

export class EvaluationEngine {
  private config: EvaluationConfig;

  constructor(apiKey: string, config: EvaluationConfig) {
    // OpenAI integration disabled for Vercel - evaluation runs on server
    this.config = config;
  }

  async loadCSV(filePath: string): Promise<Property[]> {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    return records.map((record: any) => this.normalizeProperty(record));
  }

  private normalizeProperty(raw: any): Property {
    // Map Propstream CSV columns to our standard format
    // This might need adjustment based on actual CSV structure
    return {
      address: raw['Property Address'] || raw['Address'] || '',
      city: raw['City'] || '',
      state: raw['State'] || '',
      zip: raw['Zip'] || raw['ZIP Code'] || '',
      currentValue: parseFloat(raw['Estimated Value'] || raw['AVM'] || '0'),
      bedrooms: parseInt(raw['Bedrooms'] || raw['Beds'] || '0'),
      bathrooms: parseFloat(raw['Bathrooms'] || raw['Baths'] || '0'),
      sqft: parseInt(raw['Square Feet'] || raw['Sqft'] || '0'),
      yearBuilt: parseInt(raw['Year Built'] || '0'),
      loanAmount: parseFloat(raw['Total Loan Amount'] || '0'),
      estimatedEquity: parseFloat(raw['Estimated Equity'] || '0'),
      ownerName: raw['Owner Name'] || '',
      ownerPhone: raw['Owner Phone'] || '',
      ...raw // Keep all original fields
    };
  }

  async evaluateProperty(property: Property, searchName: string): Promise<EvaluatedProperty> {
    // Basic calculations without AI (AI evaluation runs on server-side)
    const arv = property.currentValue * 1.15;
    const cashOffer = arv * 0.7;
    const wholesalePrice = cashOffer * 1.05;
    const arvSpread = ((arv - property.currentValue) / property.currentValue) * 100;
    const ltv = property.loanAmount ? (property.loanAmount / property.currentValue) * 100 : 0;

    // Determine strategy and financing
    const strategy = arvSpread > this.config.thresholds.arvSpreadMin ? 'Fix & Flip' : 'Turnkey';
    const financing = this.determineFinancing(ltv, property);

    // Generate outreach message
    const outreachMessage = this.generateOutreachMessage(
      property,
      { arv, cashOffer, wholesalePrice, strategy, financing },
      'Basic evaluation'
    );

    return {
      ...property,
      arv,
      cashOffer,
      wholesalePrice,
      arvSpread,
      ltv,
      strategy,
      financing,
      contextNotes: 'Basic evaluation (AI runs server-side)',
      outreachMessage,
      searchName,
      evaluatedAt: new Date().toISOString()
    };
  }

  private determineFinancing(ltv: number, property: Property): 'Cash Offer' | 'Seller Financing' | 'Subject To' {
    if (ltv < 50) {
      return 'Seller Financing';
    } else if (ltv > 70) {
      return 'Subject To';
    } else {
      return 'Cash Offer';
    }
  }

  private generateOutreachMessage(
    property: Property,
    evaluation: { arv: number; cashOffer: number; wholesalePrice: number; strategy: string; financing: string },
    notes: string
  ): string {
    const template = this.config.messageTemplates[
      evaluation.financing === 'Cash Offer' ? 'cashOffer' :
      evaluation.financing === 'Seller Financing' ? 'sellerFinancing' :
      'subjectTo'
    ];

    return template
      .replace('{address}', property.address)
      .replace('{city}', property.city)
      .replace('{cashOffer}', `$${evaluation.cashOffer.toLocaleString()}`)
      .replace('{arv}', `$${evaluation.arv.toLocaleString()}`)
      .replace('{notes}', notes);
  }

  async evaluateCSV(filePath: string, searchName: string): Promise<EvaluatedProperty[]> {
    const properties = await this.loadCSV(filePath);
    const evaluated: EvaluatedProperty[] = [];

    console.log(`Evaluating ${properties.length} properties from ${searchName}...`);

    for (const property of properties) {
      try {
        const result = await this.evaluateProperty(property, searchName);
        evaluated.push(result);
        console.log(`✓ Evaluated: ${property.address}`);
      } catch (error) {
        console.error(`✗ Failed to evaluate ${property.address}:`, error);
      }
    }

    return evaluated;
  }
}
