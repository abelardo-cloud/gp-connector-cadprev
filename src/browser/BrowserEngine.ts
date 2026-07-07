import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { BrowserConfig } from '../types/BrowserConfig.js';

export interface BrowserEngineLifecycle {
  start(): Promise<void>;
  newPage(): Promise<Page>;
  close(): Promise<void>;
}

export class BrowserEngine implements BrowserEngineLifecycle {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  public constructor(private readonly config: BrowserConfig) {}

  public async start(): Promise<void> {
    if (this.browser) {
      return;
    }

    this.browser = await chromium.launch({
      headless: this.config.headless,
      timeout: this.config.timeoutMs,
    });

    this.context = await this.browser.newContext({
      viewport: this.config.viewport,
      userAgent: this.config.userAgent,
    });

    this.context.setDefaultTimeout(this.config.timeoutMs);
    this.context.setDefaultNavigationTimeout(this.config.timeoutMs);
  }

  public async newPage(): Promise<Page> {
    await this.start();

    if (!this.context) {
      throw new Error('Browser context was not initialized');
    }

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(this.config.timeoutMs);
    this.page.setDefaultNavigationTimeout(this.config.timeoutMs);

    return this.page;
  }

  public async close(): Promise<void> {
    const page = this.page;
    const context = this.context;
    const browser = this.browser;

    this.page = null;
    this.context = null;
    this.browser = null;

    const closeErrors: unknown[] = [];

    if (page && !page.isClosed()) {
      try {
        await page.close();
      } catch (error) {
        closeErrors.push(error);
      }
    }

    if (context) {
      try {
        await context.close();
      } catch (error) {
        closeErrors.push(error);
      }
    }

    if (browser?.isConnected()) {
      try {
        await browser.close();
      } catch (error) {
        closeErrors.push(error);
      }
    }

    if (closeErrors.length > 0) {
      throw closeErrors[0];
    }
  }
}
