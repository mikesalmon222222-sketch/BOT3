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
      logger.info('No credentials provided, attempting to access public pages');
      return true;
    }

    try {
      // Navigate to SEPTA vendor portal login
      await this.page.goto('https://www.septa.org/business/procurement.html', {
        waitUntil: 'networkidle'
      });

      // Look for login form or links
      const loginLink = await this.page.$('a[href*="login"], a[href*="vendor"], a[href*="portal"]');
      if (loginLink) {
        await loginLink.click();
        await this.page.waitForLoadState('networkidle');
      }

      // Fill login form if available
      const usernameField = await this.page.$('input[type="text"], input[name*="user"], input[id*="user"]');
      const passwordField = await this.page.$('input[type="password"], input[name*="pass"], input[id*="pass"]');

      if (usernameField && passwordField) {
        await usernameField.fill(this.credentials.username);
        await passwordField.fill(this.credentials.password);
        
        const submitButton = await this.page.$('button[type="submit"], input[type="submit"]');
        if (submitButton) {
          await submitButton.click();
          await this.page.waitForLoadState('networkidle');
        }
      }

      logger.info('SEPTA login completed');
      return true;
    } catch (error) {
      logger.error('SEPTA login failed:', error);
      return false;
    }
  }

  async scrapeBids() {
    const bids = [];
    
    try {
      // Navigate to procurement/solicitations page
      await this.page.goto('https://www.septa.org/business/procurement.html', {
        waitUntil: 'networkidle'
      });

      // Look for solicitation links or tables
      const bidElements = await this.page.$$('table tr, .bid-item, .solicitation-item');
      
      for (const element of bidElements) {
        try {
          const bid = await this.extractBidData(element);
          if (bid) {
            bids.push(bid);
          }
        } catch (error) {
          logger.warn('Error extracting bid data:', error);
        }
      }

      // Also check for PDF documents with bid information
      const pdfLinks = await this.page.$$('a[href$=".pdf"]');
      for (const link of pdfLinks) {
        try {
          const href = await link.getAttribute('href');
          const text = await link.textContent();
          
          if (href && text && this.isBidRelated(text)) {
            const bid = {
              portal: 'SEPTA',
              title: text.trim(),
              link: new URL(href, this.page.url()).toString(),
              postedDate: new Date(),
              documents: [{
                name: text.trim(),
                url: new URL(href, this.page.url()).toString()
              }]
            };
            
            bid.titleHash = generateHash(bid.title);
            bids.push(bid);
          }
        } catch (error) {
          logger.warn('Error processing PDF link:', error);
        }
      }

      logger.info(`Scraped ${bids.length} bids from SEPTA`);
      return bids;
    } catch (error) {
      logger.error('Error scraping SEPTA bids:', error);
      return [];
    }
  }

  async extractBidData(element) {
    try {
      const titleElement = await element.$('td:first-child, .title, h3, h4');
      const linkElement = await element.$('a');
      
      if (!titleElement) return null;
      
      const title = await titleElement.textContent();
      if (!title || !this.isBidRelated(title)) return null;

      const bid = {
        portal: 'SEPTA',
        title: title.trim(),
        link: '',
        postedDate: new Date(),
        documents: []
      };

      // Extract link
      if (linkElement) {
        const href = await linkElement.getAttribute('href');
        if (href) {
          bid.link = new URL(href, this.page.url()).toString();
        }
      }

      // Try to extract dates
      const dateText = await element.textContent();
      const dateMatch = dateText.match(/(\d{1,2}\/\d{1,2}\/\d{4})/g);
      if (dateMatch && dateMatch.length > 0) {
        bid.postedDate = new Date(dateMatch[0]);
        if (dateMatch.length > 1) {
          bid.dueDate = new Date(dateMatch[1]);
        }
      }

      // Generate hash for deduplication
      bid.titleHash = generateHash(bid.title);

      return bid;
    } catch (error) {
      logger.warn('Error extracting bid data from element:', error);
      return null;
    }
  }

  isBidRelated(text) {
    const bidKeywords = [
      'solicitation', 'bid', 'rfp', 'rfq', 'proposal', 'contract',
      'procurement', 'vendor', 'invitation', 'award', 'notice'
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