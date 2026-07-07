import type { BrowserConfig, BrowserViewport } from '../types/BrowserConfig.js';

export type BrowserOptions = Omit<Partial<BrowserConfig>, 'viewport'> & {
  viewport?: Partial<BrowserViewport>;
};

export const defaultBrowserConfig: BrowserConfig = {
  headless: true,
  timeoutMs: 30_000,
  viewport: {
    width: 1280,
    height: 720,
  },
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) GovPilotConnector/1.0.0 Safari/537.36',
};

export function resolveBrowserConfig(options: BrowserOptions = {}): BrowserConfig {
  return {
    ...defaultBrowserConfig,
    ...options,
    viewport: {
      ...defaultBrowserConfig.viewport,
      ...options.viewport,
    },
  };
}
