import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { format } from 'date-fns';

interface PropstreamCredentials {
  email: string;
  password: string;
}

interface SavedSearch {
  name: string;
  url: string;
}

export class PropstreamAutomation {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private credentials: PropstreamCredentials;
  private exportDir: string;

  constructor(credentials: PropstreamCredentials) {
    this.credentials = credentials;
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    this.exportDir = path.join(process.env.HOME!, 'clawd', 'propstream-exports', dateStr);
    
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  async init() {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await this.browser.newContext({
      acceptDownloads: true
    });
    this.page = await context.newPage();
  }

  async login() {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Navigating to Propstream...');
    await this.page.goto('https://app.propstream.com/', { waitUntil: 'networkidle' });

    // Check if already logged in
    const isLoggedIn = await this.page.locator('text="My Properties", text="Search", text="Campaigns"').first().isVisible().catch(() => false);
    
    if (isLoggedIn) {
      console.log('Already logged in!');
      return;
    }

    // Wait for login form
    console.log('Waiting for login form...');
    await this.page.waitForSelector('input[placeholder*="Username"], input[placeholder*="Email"]', { timeout: 15000 });

    console.log('Filling login form...');
    await this.page.fill('input[placeholder*="Username"], input[placeholder*="Email"]', this.credentials.email);
    await this.page.fill('input[placeholder*="Password"]', this.credentials.password);

    console.log('Submitting login...');
    await this.page.click('button:has-text("Login")');

    // Wait for navigation to complete
    await this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 });
    console.log('Login successful!');
    
    // Handle the session overlay that appears after login
    console.log('Waiting for post-login overlay...');
    await this.page.waitForTimeout(3000);
    
    // Look for ANY button in the overlay dialog
    // Try multiple selectors since the button text might vary
    const buttonSelectors = [
      'button:has-text("OK")',
      'button:has-text("Ok")',
      'button:has-text("ok")',
      'button:has-text("Got it")',
      'button:has-text("Continue")',
      'button:has-text("Dismiss")',
      'button:has-text("Close")',
      '.src-app-components-SessionOverlay-style__eH1TT__session button'
    ];
    
    let buttonClicked = false;
    for (const selector of buttonSelectors) {
      const button = this.page.locator(selector).first();
      const isVisible = await button.isVisible().catch(() => false);
      if (isVisible) {
        console.log(`Found and clicking button with selector: ${selector}`);
        await button.click();
        await this.page.waitForTimeout(2000);
        buttonClicked = true;
        break;
      }
    }
    
    if (!buttonClicked) {
      console.log('No overlay button found, may not be present this session');
    }
  }

  async getAutomatedLists(): Promise<SavedSearch[]> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Navigating to My Properties...');
    
    // Click "My Properties" link (overlay should be dismissed by now)
    await this.page.click('a:has-text("My Properties")');
    await this.page.waitForTimeout(3000);

    console.log('Looking for Automated Lists section...');
    
    // For testing: Only return "Vol Flip - New" list
    const volFlipExists = await this.page.locator('text="Vol Flip - New"').isVisible().catch(() => false);
    
    if (volFlipExists) {
      console.log('Found "Vol Flip - New" automated list (10 properties)');
      return [{ name: 'Vol Flip - New', url: '' }];
    }

    console.log('"Vol Flip - New" list not found');
    return [];
  }

  async exportList(listName: string): Promise<string> {
    if (!this.page) throw new Error('Page not initialized');

    console.log(`Exporting automated list: ${listName}...`);

    // Click on the list name
    console.log(`Clicking on "${listName}" list...`);
    await this.page.click(`text="${listName}"`);
    await this.page.waitForTimeout(3000); // Wait for list properties to load

    // Check property count
    console.log('Checking property count...');
    const countText = await this.page.locator('text=/\\d+ properties/i, text=/\\d+ PROPERTIES/i').first().textContent().catch(() => '0 properties');
    console.log(`Found: ${countText}`);

    // Filter by today's date in "Date Added to List" column
    const today = format(new Date(), 'M/d/yyyy'); // Format: 2/13/2026
    console.log(`Filtering for properties added today: ${today}...`);
    
    // Look for filter option or column header
    const dateAddedHeader = this.page.locator('th:has-text("Date Added"), th:has-text("Date Added to List")').first();
    const hasDateColumn = await dateAddedHeader.isVisible().catch(() => false);
    
    if (hasDateColumn) {
      console.log('Found "Date Added to List" column, attempting to filter...');
      // Try clicking column header to access filter
      await dateAddedHeader.click();
      await this.page.waitForTimeout(500);
      
      // Look for filter input
      const filterInput = this.page.locator('input[placeholder*="filter"], input[type="text"]').first();
      const hasFilter = await filterInput.isVisible().catch(() => false);
      if (hasFilter) {
        await filterInput.fill(today);
        await this.page.waitForTimeout(1500);
      }
    }

    // Select only properties with today's date
    console.log('Selecting properties added today...');
    
    // Get all rows and check which ones have today's date
    const todayRowCount = await this.page.evaluate((todayDate) => {
      const rows = document.querySelectorAll('tr');
      let count = 0;
      rows.forEach((row) => {
        const dateCell = Array.from(row.querySelectorAll('td')).find(cell => 
          cell.textContent?.includes(todayDate)
        );
        if (dateCell) {
          const checkbox = row.querySelector('input[type="checkbox"]');
          if (checkbox && !(checkbox as HTMLInputElement).checked) {
            (checkbox as HTMLInputElement).click();
            count++;
          }
        }
      });
      return count;
    }, today);
    
    console.log(`Selected ${todayRowCount} properties added today`);
    
    if (todayRowCount === 0) {
      throw new Error('No properties added today found');
    }
    
    await this.page.waitForTimeout(1000);

    // Look for Export button (could be in Actions menu or standalone)
    console.log('Looking for Export button...');
    
    // Try Actions dropdown first
    const actionsButton = this.page.locator('button:has-text("Actions"), text="Actions"').first();
    const hasActions = await actionsButton.isVisible().catch(() => false);
    
    if (hasActions) {
      console.log('Opening Actions menu...');
      await actionsButton.click();
      await this.page.waitForTimeout(500);
      
      // Click Export in dropdown
      await this.page.click('text="Export"');
      await this.page.waitForTimeout(1500);
    } else {
      // Direct Export button
      console.log('Clicking direct Export button...');
      await this.page.click('button:has-text("Export")');
      await this.page.waitForTimeout(1500);
    }

    // Wait for export dialog/options if any
    console.log('Looking for export confirmation...');
    
    // Look for CSV format option
    const csvOption = this.page.locator('text="CSV", [value="csv"], button:has-text("CSV")').first();
    const hasCsvOption = await csvOption.isVisible().catch(() => false);
    if (hasCsvOption) {
      console.log('Selecting CSV format...');
      await csvOption.click();
      await this.page.waitForTimeout(500);
    }

    // Click Download/Export button
    console.log('Initiating download...');
    const downloadButton = this.page.locator('button:has-text("Download"), button:has-text("Export"), button:has-text("Confirm")').last();
    
    // Set up download listener
    const downloadPromise = this.page.waitForEvent('download', { timeout: 30000 });
    await downloadButton.click();
    
    console.log('Waiting for download...');
    const download = await downloadPromise;
    const filename = `${listName.replace(/[^a-z0-9]/gi, '-')}.csv`;
    const filePath = path.join(this.exportDir, filename);
    
    await download.saveAs(filePath);
    console.log(`✓ Saved to: ${filePath}`);

    return filePath;
  }

  async exportAllLists(): Promise<string[]> {
    const lists = await this.getAutomatedLists();
    const exportedFiles: string[] = [];

    for (const list of lists) {
      try {
        const filePath = await this.exportList(list.name);
        exportedFiles.push(filePath);
      } catch (error) {
        console.error(`Failed to export ${list.name}:`, error);
      }
    }

    return exportedFiles;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

// Standalone script mode
export async function runPropstreamExport() {
  const credentialsPath = path.join(process.env.HOME!, 'clawd', 'credentials', 'propstream-praxis.json');
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));

  const automation = new PropstreamAutomation({
    email: credentials.email,
    password: credentials.password
  });

  try {
    await automation.init();
    await automation.login();
    const files = await automation.exportAllLists(); // Export all automated lists
    console.log('Export complete! Files:', files);
    return { success: true, files };
  } catch (error) {
    console.error('Export failed:', error);
    return { success: false, error: String(error) };
  } finally {
    await automation.close();
  }
}
