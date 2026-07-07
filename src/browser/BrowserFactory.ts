import { BrowserEngine } from './BrowserEngine.js';
import { resolveBrowserConfig, type BrowserOptions } from './BrowserOptions.js';

export class BrowserFactory {
  public static create(options?: BrowserOptions): BrowserEngine {
    return new BrowserEngine(resolveBrowserConfig(options));
  }
}
