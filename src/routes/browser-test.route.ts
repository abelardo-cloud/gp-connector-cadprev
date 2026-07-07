import { Router, type IRouter } from 'express';
import { BrowserFactory, NavigationService } from '@govpilot/sdk';

export const browserTestRouter: IRouter = Router();

browserTestRouter.get('/browser/test', async (_req, res, next) => {
  const browserEngine = BrowserFactory.create();

  try {
    const browser = await browserEngine.launch();
    const page = await browser.newPage({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) GovPilotConnector/1.0.0 Safari/537.36',
      viewport: {
        width: 1280,
        height: 720,
      },
    });
    const navigation = new NavigationService(page);

    await navigation.open('https://example.com', {
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
