import { BrowserFactory, NavigationService } from '@govpilot/sdk';
import { Router, type IRouter } from 'express';
import { CadPrevClient } from '../cadprev/CadPrevClient.js';
import { env } from '../config/env.js';

const CADPREV_DIAGNOSTIC_URL =
  'https://cadprev.previdencia.gov.br/Cadprev/pages/publico/extrato/extratoExterno.xhtml?cnpj=82951229000176';
const EXAMPLE_URL = 'https://example.com';
const BODY_PREVIEW_LENGTH = 500;
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) GovPilotConnector/1.0.0 Safari/537.36';

export const diagnosticsRouter: IRouter = Router();

diagnosticsRouter.get('/diagnostics/http/cadprev', async (_req, res) => {
  const startedAt = Date.now();

  try {
    const response = await fetch(CADPREV_DIAGNOSTIC_URL, {
      signal: AbortSignal.timeout(env.playwrightTimeoutMs),
    });
    const body = await response.text();

    res.json({
      ok: response.ok,
      status: response.status,
      status_text: response.statusText,
      response_time_ms: Date.now() - startedAt,
      content_type: response.headers.get('content-type') ?? '',
      body_preview: body.slice(0, BODY_PREVIEW_LENGTH),
      error: null,
    });
  } catch (error) {
    res.json({
      ok: false,
      status: null,
      status_text: '',
      response_time_ms: Date.now() - startedAt,
      content_type: '',
      body_preview: '',
      error: serializeError(error),
    });
  }
});

diagnosticsRouter.get('/diagnostics/browser/example', async (_req, res) => {
  const startedAt = Date.now();
  const browserEngine = BrowserFactory.create({
    timeoutMs: env.playwrightTimeoutMs,
  });

  try {
    const browser = await browserEngine.launch();
    const page = await browser.newPage(createPageOptions());
    const navigation = new NavigationService(page);

    await navigation.open(EXAMPLE_URL, {
      waitUntil: 'domcontentloaded',
      timeoutMs: env.playwrightTimeoutMs,
    });

    res.json({
      browser: 'ok',
      url: page.url(),
      title: await page.title(),
      execution_time_ms: Date.now() - startedAt,
      error: null,
    });
  } catch (error) {
    res.json({
      browser: 'error',
      url: '',
      title: '',
      execution_time_ms: Date.now() - startedAt,
      error: serializeError(error),
    });
  } finally {
    await browserEngine.close();
  }
});

diagnosticsRouter.get('/diagnostics/browser/cadprev', async (_req, res) => {
  const startedAt = Date.now();
  const browserEngine = BrowserFactory.create({
    timeoutMs: env.playwrightTimeoutMs,
  });

  try {
    const browser = await browserEngine.launch();
    const page = await browser.newPage(createPageOptions());
    const navigation = new NavigationService(page);

    await navigation.open(CADPREV_DIAGNOSTIC_URL, {
      waitUntil: 'domcontentloaded',
      timeoutMs: env.playwrightTimeoutMs,
    });
    await navigation.waitForSelector('body', {
      timeoutMs: env.playwrightTimeoutMs,
    });

    const bodyText = await page.locator('body').innerText({
      timeout: env.playwrightTimeoutMs,
    });

    res.json({
      url_final: page.url(),
      title: await page.title(),
      execution_time_ms: Date.now() - startedAt,
      body_preview: bodyText.slice(0, BODY_PREVIEW_LENGTH),
      error: null,
    });
  } catch (error) {
    res.json({
      url_final: '',
      title: '',
      execution_time_ms: Date.now() - startedAt,
      body_preview: '',
      error: serializeError(error),
    });
  } finally {
    await browserEngine.close();
  }
});

diagnosticsRouter.get('/diagnostics/browser/cadprev-ente', async (_req, res) => {
  const cadPrevClient = new CadPrevClient();

  res.json(await cadPrevClient.diagnosticarBuscaPorEnte('Santa Catarina'));
});

function createPageOptions() {
  return {
    userAgent: DEFAULT_USER_AGENT,
    viewport: {
      width: 1280,
      height: 720,
    },
  };
}

function serializeError(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      name: 'UnknownError',
      message: String(error),
      details: '',
    };
  }

  return {
    name: error.name,
    message: error.message,
    details: error.cause instanceof Error ? error.cause.message : '',
  };
}
