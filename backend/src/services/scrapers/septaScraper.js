import { chromium } from 'playwright';
import logger from '../../utils/logger.js';
import { generateHash } from '../../utils/encryption.js';

export class SeptaScraper {
  constructor(credentials = null) {
    this.credentials = credentials;
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      this.page = await this.browser.newPage();
      
      // Set user agent to appear more legitimate
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      logger.info('SEPTA scraper initialized');
      return true;
    } catch (error) {
      logger.error('Failed to initialize SEPTA scraper:', error);
      return false;
    }
  }

  async login() {
    if (!this.credentials) {
      logger.error('No credentials provided for SEPTA vendor portal access');
      return false;
    }

    try {
      logger.info('Navigating to SEPTA vendor portal login');
      
      // Navigate to the correct SEPTA vendor portal login URL
      await this.page.goto('https://epsadmin.septa.org/vendor/login', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      logger.info('Looking for login form fields');

      // Wait for login form to load and find username/password fields
      await this.page.waitForSelector('input[type="text"], input[name*="user"], input[id*="user"], input[name*="email"]', {
        timeout: 10000
      });

      const usernameField = await this.page.$('input[type="text"], input[name*="user"], input[id*="user"], input[name*="email"]');
      const passwordField = await this.page.$('input[type="password"], input[name*="pass"], input[id*="pass"]');

      if (!usernameField || !passwordField) {
        logger.error('Login form fields not found on SEPTA vendor portal');
        return false;
      }

      logger.info('Filling login credentials');
      await usernameField.fill(this.credentials.username);
      await passwordField.fill(this.credentials.password);
      
      // Find and click submit button
      const submitButton = await this.page.$('button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
      if (!submitButton) {
        logger.error('Submit button not found on login form');
        return false;
      }

      logger.info('Submitting login form');
      await submitButton.click();
      
      // Wait for navigation after login
      await this.page.waitForLoadState('networkidle', { timeout: 15000 });

      // Check if login was successful by verifying we're on the vendor dashboard
      const currentUrl = this.page.url();
      if (currentUrl.includes('epsadmin.septa.org/vendor') && !currentUrl.includes('/login')) {
        logger.info('SEPTA login successful');
        return true;
      } else {
        logger.error(`Login may have failed. Current URL: ${currentUrl}`);
        return false;
      }
    } catch (error) {
      logger.error('SEPTA login failed:', error);
      return false;
    }
  }

  async scrapeBids() {
    const bids = [];
    
    try {
      // First, navigate to the vendor dashboard after login
      logger.info('Navigating to SEPTA vendor dashboard');
      await this.page.goto('https://epsadmin.septa.org/vendor/', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Navigate to Quotes Under $100,000 section
      logger.info('Looking for "Quotes Under $100,000" link');
      
      // Try multiple possible selectors for the link
      const quotesLink = await this.page.$('a:has-text("Quotes Under $100,000"), a[href*="requisitions"], a[href*="quotes"]');
      
      if (quotesLink) {
        logger.info('Clicking "Quotes Under $100,000" link');
        await quotesLink.click();
        await this.page.waitForLoadState('networkidle', { timeout: 15000 });
      } else {
        // If link not found, try direct navigation
        logger.info('Direct navigation to requisitions search page');
        await this.page.goto('https://epsadmin.septa.org/vendor/requisitions/search/', {
          waitUntil: 'networkidle',
          timeout: 30000
        });
      }

      // Click the Search button to get the requisitions list
      logger.info('Looking for search button');
      const searchButton = await this.page.$('button:has-text("Search"), input[type="submit"], button[type="submit"]');
      
      if (searchButton) {
        logger.info('Clicking search button');
        await searchButton.click();
        await this.page.waitForLoadState('networkidle', { timeout: 15000 });
      } else {
        // If search button not found, try direct navigation to list
        logger.info('Direct navigation to requisitions list');
        await this.page.goto('https://epsadmin.septa.org/vendor/requisitions/list/', {
          waitUntil: 'networkidle',
          timeout: 30000
        });
      }

      // Now extract bids from the requisitions list
      logger.info('Starting bid extraction from requisitions list');
      
      // Handle pagination to get all bids
      let currentPage = 1;
      let hasMorePages = true;
      
      while (hasMorePages) {
        logger.info(`Processing page ${currentPage} of requisitions`);
        
        // Extract bids from current page
        const pageBids = await this.extractBidsFromCurrentPage();
        bids.push(...pageBids);
        
        logger.info(`Found ${pageBids.length} bids on page ${currentPage}`);
        
        // Check for next page
        const nextButton = await this.page.$('a:has-text("Next"), a:has-text("→"), a[href*="page="], .pagination a:last-child');
        
        if (nextButton && await nextButton.isVisible()) {
          const nextHref = await nextButton.getAttribute('href');
          if (nextHref && !nextHref.includes('#')) {
            logger.info(`Navigating to page ${currentPage + 1}`);
            await nextButton.click();
            await this.page.waitForLoadState('networkidle', { timeout: 15000 });
            currentPage++;
          } else {
            hasMorePages = false;
          }
        } else {
          hasMorePages = false;
        }
        
        // Safety break to prevent infinite loops
        if (currentPage > 50) {
          logger.warn('Reached maximum page limit (50), stopping pagination');
          break;
        }
      }

      logger.info(`Scraped ${bids.length} total bids from SEPTA requisitions across ${currentPage} pages`);
      return bids;
    } catch (error) {
      logger.error('Error scraping SEPTA bids:', error);
      return bids; // Return whatever bids we managed to collect
    }
  }

  async extractBidsFromCurrentPage() {
    const bids = [];
    
    try {
      // Look for requisition rows in tables or list items
      const bidElements = await this.page.$$('table tbody tr, .requisition-item, .bid-row, .list-item');
      
      if (bidElements.length === 0) {
        logger.warn('No bid elements found on current page');
        return bids;
      }
      
      for (const element of bidElements) {
        try {
          const bid = await this.extractBidDataFromElement(element);
          if (bid) {
            bids.push(bid);
          }
        } catch (error) {
          logger.warn('Error extracting bid data from element:', error);
        }
      }
    } catch (error) {
      logger.error('Error extracting bids from current page:', error);
    }
    
    return bids;
  }

  async extractBidDataFromElement(element) {
    try {
      // Try to get text content first to check if this is a valid bid row
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
        description: ''
      };

      // Extract title - usually in first column or main heading
      const titleElement = await element.$('td:first-child, .title, .requisition-title, h3, h4, a');
      if (titleElement) {
        bid.title = (await titleElement.textContent()).trim();
      }

      // If no title found or title is not bid-related, skip
      if (!bid.title || !this.isBidRelated(bid.title)) {
        return null;
      }

      // Extract link - look for links within the element
      const linkElement = await element.$('a[href]');
      if (linkElement) {
        const href = await linkElement.getAttribute('href');
        if (href) {
          bid.link = new URL(href, this.page.url()).toString();
        }
      }

      // Extract dates - look for date patterns in text
      const dateRegex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g;
      const dateMatches = elementText.match(dateRegex);
      
      if (dateMatches && dateMatches.length > 0) {
        // First date is usually posted date
        bid.postedDate = this.parseDate(dateMatches[0]);
        
        // Second date (if exists) is usually due date
        if (dateMatches.length > 1) {
          bid.dueDate = this.parseDate(dateMatches[1]);
        }
      }

      // Extract amount - look for dollar amounts
      const amountRegex = /\$[\d,]+(?:\.\d{2})?/g;
      const amountMatches = elementText.match(amountRegex);
      if (amountMatches && amountMatches.length > 0) {
        bid.amount = amountMatches[0];
      }

      // Extract quantity - look for "Qty" or quantity patterns
      const qtyRegex = /(?:qty|quantity)[\s:]*(\d+(?:\.\d+)?)/i;
      const qtyMatch = elementText.match(qtyRegex);
      if (qtyMatch) {
        bid.quantity = qtyMatch[1];
      }

      // Extract external ID - look for requisition/bid numbers
      const idRegex = /(?:req|requisition|bid|rfp)[\s#:]*([a-zA-Z0-9\-]+)/i;
      const idMatch = elementText.match(idRegex);
      if (idMatch) {
        bid.externalId = idMatch[1];
      }

      // Extract description - use full text content as description
      bid.description = elementText.trim();

      // Look for document links within this bid element
      const docLinks = await element.$$('a[href$=".pdf"], a[href$=".doc"], a[href$=".docx"], a[href*="document"]');
      for (const docLink of docLinks) {
        try {
          const docHref = await docLink.getAttribute('href');
          const docText = await docLink.textContent();
          
          if (docHref && docText) {
            bid.documents.push({
              name: docText.trim(),
              url: new URL(docHref, this.page.url()).toString()
            });
          }
        } catch (error) {
          logger.warn('Error extracting document link:', error);
        }
      }

      // Filter out expired bids - only keep current and future bids
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
      // Handle different date formats
      let cleanDate = dateString.replace(/[^\d\/\-]/g, '');
      
      // Convert to MM/DD/YYYY format for consistent parsing
      if (cleanDate.includes('-')) {
        cleanDate = cleanDate.replace(/-/g, '/');
      }
      
      const date = new Date(cleanDate);
      return isNaN(date.getTime()) ? null : date;
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
      'equipment', 'maintenance', 'construction', 'repair'
    ];
    
    const lowerText = text.toLowerCase();
    return bidKeywords.some(keyword => lowerText.includes(keyword));
  }

  async testConnection() {
    try {
      await this.initialize();
      const loginResult = await this.login();
      await this.cleanup();
      return loginResult;
    } catch (error) {
      logger.error('SEPTA connection test failed:', error);
      return false;
    }
  }

  async cleanup() {
    try {
      if (this.page) {
        await this.page.close();
      }
      if (this.browser) {
        await this.browser.close();
      }
      logger.info('SEPTA scraper cleaned up');
    } catch (error) {
      logger.error('Error cleaning up SEPTA scraper:', error);
    }
  }
}