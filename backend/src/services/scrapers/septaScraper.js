import { chromium } from 'playwright';
import logger from '../../utils/logger.js';
import { generateHash } from '../../utils/encryption.js';

export class SeptaScraper {
  constructor(credentials = null) {
    this.credentials = credentials;
    this.browser = null;
    this.page = null;
    this.screenshotDir = '/tmp/septa-screenshots';
    this.debugMode = process.env.SEPTA_DEBUG === 'true' || false;
  }

  async initialize() {
    try {
      logger.info('Initializing SEPTA scraper...');
      
      // Try different Chrome paths and configurations
      const launchOptions = {
        headless: true, // Always use headless in sandboxed environments
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-gpu'
        ]
      };

      // Try to use system Chrome if Playwright browsers aren't available
      try {
        this.browser = await chromium.launch(launchOptions);
        logger.info('Playwright Chromium launched successfully');
      } catch (error) {
        logger.warn('Playwright Chromium failed, trying system Chrome:', error.message);
        launchOptions.executablePath = '/usr/bin/google-chrome-stable';
        this.browser = await chromium.launch(launchOptions);
        logger.info('System Chrome launched successfully');
      }

      this.page = await this.browser.newPage();
      
      // Set realistic user agent and viewport (try different method names)
      try {
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      } catch (error) {
        logger.warn('setUserAgent failed, trying alternative method:', error.message);
        try {
          await this.page.setExtraHTTPHeaders({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          });
        } catch (error2) {
          logger.warn('setExtraHTTPHeaders also failed:', error2.message);
        }
      }
      
      try {
        await this.page.setViewportSize({ width: 1366, height: 768 });
      } catch (error) {
        logger.warn('setViewportSize failed:', error.message);
      }
      
      // Enable request interception for debugging
      if (this.debugMode) {
        try {
          await this.page.route('**/*', (route) => {
            logger.debug(`Request: ${route.request().method()} ${route.request().url()}`);
            route.continue();
          });
        } catch (error) {
          logger.warn('Failed to enable request interception:', error.message);
        }
      }

      // Create screenshot directory
      try {
        const fs = await import('fs');
        await fs.promises.mkdir(this.screenshotDir, { recursive: true });
      } catch (error) {
        logger.warn('Could not create screenshot directory:', error.message);
      }
      
      logger.info('SEPTA scraper initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize SEPTA scraper:', error);
      throw new Error(`Scraper initialization failed: ${error.message}`);
    }
  }

  async login() {
    if (!this.credentials) {
      logger.error('No credentials provided for SEPTA vendor portal access');
      throw new Error('SEPTA credentials are required');
    }

    try {
      logger.info('Starting SEPTA vendor portal login process');
      
      // Navigate to the SEPTA vendor portal login URL
      const loginUrl = 'https://epsadmin.septa.org/vendor/login';
      logger.info(`Navigating to login page: ${loginUrl}`);
      
      await this.page.goto(loginUrl, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Take screenshot of login page
      await this.takeDebugScreenshot('01-login-page');

      logger.info('Page loaded, looking for login form fields');

      // Wait for the page to fully load and find form elements
      try {
        await this.page.waitForSelector('form, input[type="text"], input[type="email"], input[name*="user"]', {
          timeout: 15000
        });
      } catch (error) {
        logger.error('Login form not found on page');
        await this.takeDebugScreenshot('error-no-login-form');
        throw new Error('Login form not found on SEPTA portal');
      }

      // Look for username field with multiple selectors
      const usernameSelectors = [
        'input[type="text"]',
        'input[type="email"]', 
        'input[name*="user"]',
        'input[id*="user"]',
        'input[name*="email"]',
        'input[name="username"]',
        'input[name="login"]',
        'input[placeholder*="user"]',
        'input[placeholder*="email"]'
      ];

      let usernameField = null;
      for (const selector of usernameSelectors) {
        try {
          usernameField = await this.page.$(selector);
          if (usernameField) {
            logger.info(`Found username field with selector: ${selector}`);
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }

      // Look for password field
      const passwordSelectors = [
        'input[type="password"]',
        'input[name*="pass"]',
        'input[id*="pass"]',
        'input[name="password"]',
        'input[placeholder*="pass"]'
      ];

      let passwordField = null;
      for (const selector of passwordSelectors) {
        try {
          passwordField = await this.page.$(selector);
          if (passwordField) {
            logger.info(`Found password field with selector: ${selector}`);
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }

      if (!usernameField || !passwordField) {
        logger.error('Login form fields not found on SEPTA vendor portal');
        
        // Debug: log page content
        const pageContent = await this.page.content();
        logger.debug('Page content preview:', pageContent.substring(0, 1000));
        
        await this.takeDebugScreenshot('error-missing-fields');
        throw new Error('Username or password field not found on login form');
      }

      logger.info('Filling in login credentials');
      await usernameField.fill(this.credentials.username);
      await passwordField.fill(this.credentials.password);
      
      await this.takeDebugScreenshot('02-credentials-filled');

      // Look for submit button with multiple selectors
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Login")',
        'button:has-text("Sign In")',
        'button:has-text("Submit")',
        'input[value*="Login"]',
        'input[value*="Sign In"]',
        '.login-button',
        '#login-button',
        '[class*="submit"]'
      ];

      let submitButton = null;
      for (const selector of submitSelectors) {
        try {
          submitButton = await this.page.$(selector);
          if (submitButton && await submitButton.isVisible()) {
            logger.info(`Found submit button with selector: ${selector}`);
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }

      if (!submitButton) {
        logger.error('Submit button not found on login form');
        await this.takeDebugScreenshot('error-no-submit-button');
        throw new Error('Submit button not found on login form');
      }

      logger.info('Submitting login form');
      
      // Listen for navigation events
      const navigationPromise = this.page.waitForLoadState('networkidle', { timeout: 20000 });
      
      await submitButton.click();
      
      try {
        await navigationPromise;
      } catch (error) {
        logger.warn('Navigation timeout after login, checking current state');
      }

      await this.takeDebugScreenshot('03-after-login');

      // Check if login was successful
      const currentUrl = this.page.url();
      logger.info(`Current URL after login: ${currentUrl}`);

      // Multiple ways to verify successful login
      const loginSuccess = 
        (currentUrl.includes('epsadmin.septa.org/vendor') && !currentUrl.includes('/login')) ||
        await this.page.$('text=Dashboard') ||
        await this.page.$('text=Vendor Portal') ||
        await this.page.$('a[href*="requisitions"]') ||
        await this.page.$('text=Quotes Under');

      if (loginSuccess) {
        logger.info('SEPTA login successful - user authenticated');
        await this.takeDebugScreenshot('04-login-success');
        return true;
      } else {
        // Check for error messages
        const errorSelectors = [
          '.error',
          '.alert',
          '[class*="error"]',
          '[class*="alert"]',
          'text=Invalid',
          'text=Error',
          'text=Failed'
        ];

        let errorMessage = 'Unknown login error';
        for (const selector of errorSelectors) {
          try {
            const errorElement = await this.page.$(selector);
            if (errorElement) {
              errorMessage = await errorElement.textContent();
              break;
            }
          } catch (error) {
            // Continue checking
          }
        }

        logger.error(`SEPTA login failed. Current URL: ${currentUrl}, Error: ${errorMessage}`);
        await this.takeDebugScreenshot('error-login-failed');
        throw new Error(`Login failed: ${errorMessage}`);
      }
    } catch (error) {
      logger.error('SEPTA login process failed:', error);
      await this.takeDebugScreenshot('error-login-exception');
      throw error;
    }
  }

  async scrapeBids() {
    const bids = [];
    
    try {
      logger.info('Starting SEPTA bid scraping process');
      
      // Navigate to vendor dashboard first
      logger.info('Navigating to SEPTA vendor dashboard');
      await this.page.goto('https://epsadmin.septa.org/vendor/', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      await this.takeDebugScreenshot('05-vendor-dashboard');

      // Look for "Quotes Under $100,000" or similar links
      logger.info('Looking for "Quotes Under $100,000" section');
      
      const quotesLinkSelectors = [
        'a:has-text("Quotes Under $100,000")',
        'a[href*="requisitions"]',
        'a[href*="quotes"]',
        'a:has-text("Requisitions")',
        'a:has-text("Procurement")',
        'a:has-text("Bids")',
        '[href*="search"]',
        'text=Quotes Under'
      ];

      let quotesLink = null;
      for (const selector of quotesLinkSelectors) {
        try {
          quotesLink = await this.page.$(selector);
          if (quotesLink && await quotesLink.isVisible()) {
            logger.info(`Found quotes link with selector: ${selector}`);
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }

      if (quotesLink) {
        logger.info('Clicking quotes/requisitions link');
        await quotesLink.click();
        await this.page.waitForLoadState('networkidle', { timeout: 15000 });
        await this.takeDebugScreenshot('06-after-quotes-click');
      } else {
        // Try direct navigation to known endpoints
        logger.info('Direct navigation to requisitions search page');
        try {
          await this.page.goto('https://epsadmin.septa.org/vendor/requisitions/search/', {
            waitUntil: 'networkidle',
            timeout: 30000
          });
          await this.takeDebugScreenshot('07-requisitions-search-direct');
        } catch (error) {
          logger.warn('Direct navigation to search page failed, trying list page');
          await this.page.goto('https://epsadmin.septa.org/vendor/requisitions/list/', {
            waitUntil: 'networkidle',
            timeout: 30000
          });
          await this.takeDebugScreenshot('08-requisitions-list-direct');
        }
      }

      // Look for and submit search form if present
      logger.info('Looking for search form');
      const searchButtonSelectors = [
        'button:has-text("Search")',
        'input[type="submit"]',
        'button[type="submit"]',
        '[value="Search"]',
        '.search-button',
        '#search-button'
      ];

      let searchButton = null;
      for (const selector of searchButtonSelectors) {
        try {
          searchButton = await this.page.$(selector);
          if (searchButton && await searchButton.isVisible()) {
            logger.info(`Found search button with selector: ${selector}`);
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }

      if (searchButton) {
        logger.info('Submitting search form');
        await searchButton.click();
        await this.page.waitForLoadState('networkidle', { timeout: 15000 });
        await this.takeDebugScreenshot('09-search-results');
      }

      // Handle pagination and extract bids
      logger.info('Starting bid extraction with pagination');
      
      let currentPage = 1;
      let hasMorePages = true;
      let totalBidsFound = 0;
      
      while (hasMorePages && currentPage <= 50) {
        logger.info(`Processing page ${currentPage} of requisitions`);
        
        // Extract bids from current page
        const pageBids = await this.extractBidsFromCurrentPage();
        bids.push(...pageBids);
        totalBidsFound += pageBids.length;
        
        logger.info(`Found ${pageBids.length} bids on page ${currentPage} (total: ${totalBidsFound})`);
        
        if (currentPage === 1) {
          await this.takeDebugScreenshot(`10-page-${currentPage}-results`);
        }
        
        // Look for next page button
        const nextButtonSelectors = [
          'a:has-text("Next")',
          'a:has-text("→")',
          'a[href*="page="]',
          '.pagination a:last-child',
          '[class*="next"]',
          '[aria-label*="Next"]'
        ];

        let nextButton = null;
        for (const selector of nextButtonSelectors) {
          try {
            nextButton = await this.page.$(selector);
            if (nextButton && await nextButton.isVisible()) {
              const href = await nextButton.getAttribute('href');
              if (href && !href.includes('#')) {
                logger.info(`Found next button with selector: ${selector}`);
                break;
              }
            }
            nextButton = null;
          } catch (error) {
            // Continue to next selector
          }
        }

        if (nextButton) {
          try {
            logger.info(`Navigating to page ${currentPage + 1}`);
            await nextButton.click();
            await this.page.waitForLoadState('networkidle', { timeout: 15000 });
            currentPage++;
            
            // Small delay to avoid overwhelming the server
            await this.page.waitForTimeout(1000);
          } catch (error) {
            logger.warn(`Error navigating to next page: ${error.message}`);
            hasMorePages = false;
          }
        } else {
          logger.info('No more pages found');
          hasMorePages = false;
        }
      }

      if (currentPage > 50) {
        logger.warn('Reached maximum page limit (50), stopping pagination');
      }

      logger.info(`Scraped ${bids.length} total bids from SEPTA requisitions across ${currentPage} pages`);
      
      // Take final screenshot showing results
      await this.takeDebugScreenshot('11-scraping-complete');
      
      return bids;
    } catch (error) {
      logger.error('Error scraping SEPTA bids:', error);
      await this.takeDebugScreenshot('error-scraping-failed');
      throw error;
    }
  }

  async extractBidsFromCurrentPage() {
    const bids = [];
    
    try {
      logger.info('Extracting bids from current page');
      
      // Look for bid/requisition rows with multiple selectors
      const bidRowSelectors = [
        'table tbody tr',
        '.requisition-item',
        '.bid-row',
        '.list-item',
        '.procurement-item',
        '[class*="row"]',
        'tr[class*="data"]',
        'div[class*="item"]'
      ];

      let bidElements = [];
      for (const selector of bidRowSelectors) {
        try {
          const elements = await this.page.$$(selector);
          if (elements.length > 0) {
            logger.info(`Found ${elements.length} bid elements with selector: ${selector}`);
            bidElements = elements;
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }
      
      if (bidElements.length === 0) {
        logger.warn('No bid elements found on current page');
        
        // Debug: check what content is actually on the page
        const pageText = await this.page.textContent('body');
        logger.debug('Page text preview:', pageText.substring(0, 500));
        
        return bids;
      }
      
      logger.info(`Processing ${bidElements.length} potential bid elements`);
      
      for (let i = 0; i < bidElements.length; i++) {
        try {
          const bid = await this.extractBidDataFromElement(bidElements[i]);
          if (bid) {
            bids.push(bid);
            logger.debug(`Extracted bid: ${bid.title}`);
          }
        } catch (error) {
          logger.warn(`Error extracting bid data from element ${i}:`, error.message);
        }
      }
      
      logger.info(`Successfully extracted ${bids.length} valid bids from page`);
    } catch (error) {
      logger.error('Error extracting bids from current page:', error);
    }
    
    return bids;
  }

  async extractBidDataFromElement(element) {
    try {
      // Get text content to validate this is a bid row
      const elementText = await element.textContent();
      if (!elementText || elementText.trim().length === 0) {
        return null;
      }

      // Initialize bid object with required structure
      const bid = {
        portal: 'SEPTA',
        title: '',
        postedDate: null,
        dueDate: null,
        amount: '',
        quantity: '',
        link: '',
        documents: [],
        externalId: '',
        description: '',
        status: 'open'
      };

      // Extract title - try multiple selectors
      const titleSelectors = [
        'td:first-child a',
        'td:first-child',
        '.title',
        '.requisition-title',
        'h3',
        'h4',
        'a[href*="requisition"]',
        'a[href*="bid"]'
      ];

      for (const selector of titleSelectors) {
        try {
          const titleElement = await element.$(selector);
          if (titleElement) {
            const titleText = (await titleElement.textContent()).trim();
            if (titleText && titleText.length > 10) { // Reasonable title length
              bid.title = titleText;
              break;
            }
          }
        } catch (error) {
          // Continue to next selector
        }
      }

      // If no specific title found, use first meaningful text
      if (!bid.title) {
        const words = elementText.trim().split(/\s+/);
        if (words.length >= 3) {
          bid.title = words.slice(0, 10).join(' '); // Take first 10 words
        }
      }

      // Validate title is bid-related
      if (!bid.title || !this.isBidRelated(bid.title)) {
        return null;
      }

      // Extract link
      const linkSelectors = [
        'a[href*="requisition"]',
        'a[href*="bid"]',
        'a[href*="detail"]',
        'a[href*="view"]',
        'a[href]'
      ];

      for (const selector of linkSelectors) {
        try {
          const linkElement = await element.$(selector);
          if (linkElement) {
            const href = await linkElement.getAttribute('href');
            if (href) {
              bid.link = new URL(href, this.page.url()).toString();
              break;
            }
          }
        } catch (error) {
          // Continue to next selector
        }
      }

      // Extract dates using improved regex patterns
      const datePatterns = [
        /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g,
        /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/g,
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/gi,
        /(\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/gi
      ];

      const allDates = [];
      for (const pattern of datePatterns) {
        const matches = elementText.match(pattern);
        if (matches) {
          allDates.push(...matches);
        }
      }

      if (allDates.length > 0) {
        // Parse and sort dates
        const parsedDates = allDates
          .map(dateStr => this.parseDate(dateStr))
          .filter(date => date !== null)
          .sort((a, b) => a - b);

        if (parsedDates.length > 0) {
          bid.postedDate = parsedDates[0]; // Earliest date is usually posted date
          if (parsedDates.length > 1) {
            bid.dueDate = parsedDates[parsedDates.length - 1]; // Latest date is usually due date
          }
        }
      }

      // Extract amount with improved regex
      const amountPatterns = [
        /\$[\d,]+(?:\.\d{2})?/g,
        /\$\s*[\d,]+(?:\.\d{2})?/g,
        /USD\s*[\d,]+(?:\.\d{2})?/gi,
        /Amount:\s*\$?[\d,]+(?:\.\d{2})?/gi
      ];

      for (const pattern of amountPatterns) {
        const amountMatches = elementText.match(pattern);
        if (amountMatches && amountMatches.length > 0) {
          bid.amount = amountMatches[0].replace(/[^\d,.$]/g, '');
          break;
        }
      }

      // Extract quantity
      const qtyPatterns = [
        /(?:qty|quantity)[\s:]*(\d+(?:\.\d+)?)/gi,
        /(\d+)\s*(?:each|units?|pieces?|items?)/gi,
        /amount:\s*(\d+)/gi
      ];

      for (const pattern of qtyPatterns) {
        const qtyMatch = elementText.match(pattern);
        if (qtyMatch) {
          bid.quantity = qtyMatch[1];
          break;
        }
      }

      // Extract external ID (requisition number)
      const idPatterns = [
        /(?:req|requisition)[\s#:]*([a-zA-Z0-9\-]+)/gi,
        /(?:bid|rfp|rfq)[\s#:]*([a-zA-Z0-9\-]+)/gi,
        /(?:solicitation)[\s#:]*([a-zA-Z0-9\-]+)/gi,
        /#([a-zA-Z0-9\-]+)/g
      ];

      for (const pattern of idPatterns) {
        const idMatch = elementText.match(pattern);
        if (idMatch) {
          bid.externalId = idMatch[1];
          break;
        }
      }

      // Set description to cleaned text content
      bid.description = elementText.replace(/\s+/g, ' ').trim();

      // Look for document links
      const docSelectors = [
        'a[href$=".pdf"]',
        'a[href$=".doc"]',
        'a[href$=".docx"]',
        'a[href*="document"]',
        'a[href*="attachment"]',
        'a:has-text("Download")',
        'a:has-text("Document")'
      ];

      for (const selector of docSelectors) {
        try {
          const docLinks = await element.$$(selector);
          for (const docLink of docLinks) {
            const docHref = await docLink.getAttribute('href');
            const docText = await docLink.textContent();
            
            if (docHref && docText) {
              bid.documents.push({
                name: docText.trim(),
                url: new URL(docHref, this.page.url()).toString()
              });
            }
          }
        } catch (error) {
          // Continue to next selector
        }
      }

      // Filter out expired bids
      if (bid.dueDate && bid.dueDate < new Date()) {
        logger.debug(`Skipping expired bid: ${bid.title} (due: ${bid.dueDate})`);
        return null;
      }

      // Generate hash for deduplication
      bid.titleHash = generateHash(bid.title);

      return bid;
    } catch (error) {
      logger.warn('Error extracting bid data from element:', error);
      return null;
    }
  }

  parseDate(dateString) {
    try {
      if (!dateString) return null;
      
      // Clean the date string
      let cleanDate = dateString.trim();
      
      // Handle different date formats
      const dateFormats = [
        // MM/DD/YYYY or MM-DD-YYYY
        /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/,
        // YYYY/MM/DD or YYYY-MM-DD
        /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/,
        // Month DD, YYYY
        /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})$/i,
        // DD Month YYYY
        /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i
      ];

      for (const format of dateFormats) {
        const match = cleanDate.match(format);
        if (match) {
          let date;
          
          if (format.source.includes('Jan|Feb')) {
            // Month name formats
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            let month, day, year;
            
            if (match[1].match(/^\d/)) {
              // DD Month YYYY
              day = parseInt(match[1]);
              month = monthNames.indexOf(match[2].substr(0, 3)) + 1;
              year = parseInt(match[3]);
            } else {
              // Month DD, YYYY
              month = monthNames.indexOf(match[1].substr(0, 3)) + 1;
              day = parseInt(match[2]);
              year = parseInt(match[3]);
            }
            
            date = new Date(year, month - 1, day);
          } else if (match[1].length === 4) {
            // YYYY-MM-DD format
            date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
          } else {
            // MM/DD/YYYY format
            const month = parseInt(match[1]);
            const day = parseInt(match[2]);
            let year = parseInt(match[3]);
            
            // Handle 2-digit years
            if (year < 100) {
              year += year < 50 ? 2000 : 1900;
            }
            
            date = new Date(year, month - 1, day);
          }
          
          // Validate the date
          if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
            return date;
          }
        }
      }
      
      // Fallback to JavaScript's Date parser
      const fallbackDate = new Date(cleanDate);
      if (!isNaN(fallbackDate.getTime())) {
        return fallbackDate;
      }
      
      return null;
    } catch (error) {
      logger.warn(`Error parsing date: ${dateString}`, error);
      return null;
    }
  }

  isBidRelated(text) {
    const bidKeywords = [
      'solicitation', 'bid', 'rfp', 'rfq', 'proposal', 'contract',
      'procurement', 'vendor', 'invitation', 'award', 'notice',
      'requisition', 'quote', 'purchase', 'services', 'supplies',
      'equipment', 'maintenance', 'construction', 'repair',
      'consulting', 'professional', 'installation', 'delivery'
    ];
    
    const lowerText = text.toLowerCase();
    return bidKeywords.some(keyword => lowerText.includes(keyword));
  }

  async takeDebugScreenshot(filename) {
    if (!this.page || !this.debugMode) return;
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotPath = `${this.screenshotDir}/${timestamp}-${filename}.png`;
      
      await this.page.screenshot({
        path: screenshotPath,
        fullPage: true
      });
      
      logger.info(`Debug screenshot saved: ${screenshotPath}`);
    } catch (error) {
      logger.warn(`Failed to take debug screenshot: ${error.message}`);
    }
  }

  async testConnection() {
    try {
      logger.info('Starting SEPTA connection test');
      await this.initialize();
      const loginResult = await this.login();
      await this.cleanup();
      logger.info(`SEPTA connection test completed: ${loginResult ? 'SUCCESS' : 'FAILED'}`);
      return loginResult;
    } catch (error) {
      logger.error('SEPTA connection test failed:', error);
      await this.cleanup();
      return false;
    }
  }

  async cleanup() {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      logger.info('SEPTA scraper cleaned up successfully');
    } catch (error) {
      logger.error('Error cleaning up SEPTA scraper:', error);
    }
  }
}