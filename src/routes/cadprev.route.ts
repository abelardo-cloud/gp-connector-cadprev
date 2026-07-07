import { Router, type IRouter } from 'express';
import { CadPrevClient } from '../cadprev/CadPrevClient.js';
import type { CadPrevCrpResponse } from '../cadprev/CadPrevTypes.js';

export const cadPrevRouter: IRouter = Router();

cadPrevRouter.get('/api/v1/cadprev/crp', async (req, res, next) => {
  const cnpj = getSingleQueryParam(req.query.cnpj);

  if (!cnpj) {
    res.status(400).json({
      error: 'cnpj is required',
    });
    return;
  }

  const cadPrevClient = new CadPrevClient();

  try {
    const extrato = await cadPrevClient.consultarExtratoPorCnpj(cnpj);
    const response: CadPrevCrpResponse = {
      fonte: 'CadPrev Público',
      url_consultada: cadPrevClient.buildExtratoUrl(cnpj),
      ente: extrato.ente,
      uf: extrato.uf,
      cnpj: extrato.cnpj,
      crp: extrato.crp,
      resumo: extrato.resumo,
      criterios: extrato.criterios,
      criterios_irregulares: extrato.criterios_irregulares,
      diagnostico_base: extrato.diagnostico_base,
      consultado_em: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

function getSingleQueryParam(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0].trim() || undefined;
  }

  return undefined;
}
