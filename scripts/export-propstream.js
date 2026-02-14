#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function exportPropstream() {
  const credentials = JSON.parse(
    fs.readFileSync(path.join(process.env.HOME, 'clawd', 'credentials', 'propstream-praxis.json'), 'utf-8')
  );
  
  const today = new Date().toISOString().split('T')[0];
  const exportDir = path.join(process.env.HOME, 'clawd', 'propstream-exports', today);
  
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  
  try {
    // Login
    console.log('Navigating to Propstream...');
    await page.goto('https://app.propstream.com/');
    
    await page.fill('input[placeholder*="Username"], input[placeholder*="Email"]', credentials.email);
    await page.fill('input[placeholder*="Password"]', credentials.password);
    await page.click('button:has-text("Login")');
    
    await page.waitForNavigation({ timeout: 30000 });
    console.log('Logged in');
    
    // Handle overlays - try multiple approaches
    await page.waitForTimeout(3000);
    
    // Try finding and clicking any visible button in an overlay/dialog
    const overlayButtons = await page.locator('.src-app-components-SessionOverlay-style__eH1TT__session button, [role="dialog"] button, [role="alertdialog"] button').all();
    
    for (const btn of overlayButtons) {
      if (await btn.isVisible()) {
        const text = await btn.textContent();
        console.log(`Clicking overlay button: ${text}`);
        await btn.click();
        await page.waitForTimeout(1000);
      }
    }
    
    // Navigate to My Properties
    console.log('Navigating to My Properties...');
    await page.click('a:has-text("My Properties")');
    await page.waitForTimeout(3000);
    
    // Click on Vol Flip - New - wait for it to be visible first
    console.log('Waiting for Vol Flip - New list...');
    await page.waitForSelector('text="Vol Flip - New"', { state: 'visible', timeout: 15000 });
    console.log('Clicking Vol Flip - New list...');
    await page.click('text="Vol Flip - New"');
    await page.waitForTimeout(3000);
    
    // Select all properties
    console.log('Selecting all properties...');
    const selectAllCheckbox = page.locator('th input[type="checkbox"], th [role="checkbox"]').first();
    await selectAllCheckbox.click();
    await page.waitForTimeout(2000);
    
    // Click Export button
    console.log('Clicking Export...');
    await page.click('button:has-text("Export")');
    await page.waitForTimeout(1500);
    
    // Handle download
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    
    // Click Download/Confirm if needed
    const downloadBtn = page.locator('button:has-text("Download"), button:has-text("Confirm"), button:has-text("Export")').last();
    if (await downloadBtn.isVisible()) {
      await downloadBtn.click();
    }
    
    const download = await downloadPromise;
    const filePath = path.join(exportDir, 'Vol-Flip-New.csv');
    await download.saveAs(filePath);
    
    console.log(`✅ Export complete: ${filePath}`);
    
    const rowCount = fs.readFileSync(filePath, 'utf-8').split('\n').length;
    console.log(`Row count: ${rowCount}`);
    
    await browser.close();
    
    return { success: true, file: filePath, rows: rowCount };
    
  } catch (error) {
    await browser.close();
    throw error;
  }
}

exportPropstream()
  .then(result => {
    console.log(JSON.stringify(result));
    process.exit(0);
  })
  .catch(error => {
    console.error(JSON.stringify({ success: false, error: error.message }));
    process.exit(1);
  });
