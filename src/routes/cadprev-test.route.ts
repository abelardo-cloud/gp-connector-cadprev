import { Router, type IRouter } from 'express';
import { CadPrevClient } from '../cadprev/CadPrevClient.js';

export const cadPrevTestRouter: IRouter = Router();

cadPrevTestRouter.get('/cadprev/test', async (_req, res, next) => {
  const cadPrevClient = new CadPrevClient();

  try {
    const extrato = await cadPrevClient.consultarExtratoPorCnpj('82951229000176');

    res.json(extrato);
  } catch (error) {
    next(error);
  }
});
