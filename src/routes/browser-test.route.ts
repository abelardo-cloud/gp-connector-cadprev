import { Router, type IRouter } from 'express';
import { BrowserFactory } from '../browser/BrowserFactory.js';

export const browserTestRouter: IRouter = Router();

browserTestRouter.get('/browser/test', async (_req, res, next) => {
  const browserEngine = BrowserFactory.create();

  try {
    const page = await browserEngine.newPage();

    await page.goto('https://example.com', {
      waitUntil: 'domcontentloaded',
    });

    await browserEngine.close();

    res.json({
      browser: 'ok',
    });
  } catch (error) {
    try {
      await browserEngine.close();
    } catch (closeError) {
      next(closeError);
      return;
    }

    next(error);
  }
});
