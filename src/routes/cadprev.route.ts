import { Router, type IRouter } from 'express';
import { MemoryCache } from '../cache/MemoryCache.js';
import { CadPrevClient } from '../cadprev/CadPrevClient.js';
import type { CadPrevCrpResponse, CadPrevErrorResponse } from '../cadprev/CadPrevTypes.js';
import { env } from '../config/env.js';

export const cadPrevRouter: IRouter = Router();
const crpResponseCache = new MemoryCache<CadPrevCrpResponse>();

cadPrevRouter.get('/api/v1/cadprev/crp', async (req, res, next) => {
  const cnpj = getSingleQueryParam(req.query.cnpj);

  if (!cnpj) {
    res.status(400).json({
      error: 'cnpj is required',
    });
    return;
  }

  const normalizedCnpj = normalizeCnpj(cnpj);
  const cacheKey = buildCrpCacheKey(normalizedCnpj);
  const cachedResponse = crpResponseCache.get(cacheKey);

  if (cachedResponse) {
    res.json({
      ...cachedResponse,
      cache: {
        hit: true,
        ttl_seconds: env.cacheTtlSeconds,
      },
    });
    return;
  }

  const cadPrevClient = new CadPrevClient();

  try {
    const extrato = await cadPrevClient.consultarExtratoPorCnpj(normalizedCnpj);
    const response: CadPrevCrpResponse = {
      fonte: 'CadPrev Público',
      url_consultada: cadPrevClient.buildExtratoUrl(normalizedCnpj),
      ente: extrato.ente,
      uf: extrato.uf,
      cnpj: extrato.cnpj,
      crp: extrato.crp,
      resumo: extrato.resumo,
      criterios: extrato.criterios,
      criterios_irregulares: extrato.criterios_irregulares,
      diagnostico_base: extrato.diagnostico_base,
      cache: {
        hit: false,
        ttl_seconds: env.cacheTtlSeconds,
      },
      consultado_em: new Date().toISOString(),
    };

    crpResponseCache.set(cacheKey, response, env.cacheTtlSeconds);

    res.json(response);
  } catch (error) {
    if (isTimeoutError(error)) {
      res.status(504).json(createCadPrevTimeoutResponse(error));
      return;
    }

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

function normalizeCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}

function buildCrpCacheKey(cnpj: string): string {
  return `cadprev:crp:cnpj:${cnpj}`;
}

function createCadPrevTimeoutResponse(error: unknown): CadPrevErrorResponse {
  return {
    status: 'error',
    source: 'CadPrev Público',
    code: 'CADPREV_TIMEOUT',
    message: 'O CadPrev Público não respondeu dentro do tempo limite.',
    details: error instanceof Error ? error.message : String(error),
    consultado_em: new Date().toISOString(),
  };
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === 'BrowserTimeoutError' || error.name === 'TimeoutError') {
    return true;
  }

  return isTimeoutError(error.cause);
}
