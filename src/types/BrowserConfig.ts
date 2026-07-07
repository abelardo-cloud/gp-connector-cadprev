export interface BrowserViewport {
  width: number;
  height: number;
}

export interface BrowserConfig {
  headless: boolean;
  timeoutMs: number;
  viewport: BrowserViewport;
  userAgent: string;
}
