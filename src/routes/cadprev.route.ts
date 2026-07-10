import { Router, type IRouter } from 'express';
import { MemoryCache } from '../cache/MemoryCache.js';
import { CadPrevClient } from '../cadprev/CadPrevClient.js';
import { CadPrevEnteSearchAmbiguityError } from '../cadprev/CadPrevEnteSearchResultSelector.js';
import { CadPrevRequestScheduler } from '../cadprev/CadPrevRequestScheduler.js';
import {
  CadPrevRetryExhaustedError,
  executeWithCadPrevRetry,
  type CadPrevRetryMetadata,
} from '../cadprev/CadPrevRetryPolicy.js';
import { cadPrevSourceStatus, type CadPrevSourceErrorOrigin } from '../cadprev/CadPrevSourceStatus.js';
import type { CadPrevExtrato } from '../cadprev/CadPrevTypes.js';
import type { CadPrevCrpResponse, CadPrevErrorResponse } from '../cadprev/CadPrevTypes.js';
import { env } from '../config/env.js';

export const cadPrevRouter: IRouter = Router();
const crpResponseCache = new MemoryCache<CadPrevCrpResponse>();
const cadPrevRequestScheduler = new CadPrevRequestScheduler({
  maxConcurrentRequests: env.cadPrevMaxConcurrentRequests,
  minRequestIntervalMs: env.cadPrevMinRequestIntervalMs,
});
type CadPrevUnavailableErrorOrigin = Exclude<CadPrevSourceErrorOrigin, 'connector_internal'>;

cadPrevRouter.get('/api/v1/cadprev/crp', async (req, res, next) => {
  const cnpj = getSingleQueryParam(req.query.cnpj);
  const ente = getSingleQueryParam(req.query.ente);

  if (!cnpj && !ente) {
    res.status(400).json({
      error: 'cnpj or ente is required',
    });
    return;
  }

  const query = cnpj
    ? {
        type: 'cnpj' as const,
        value: normalizeCnpj(cnpj),
      }
    : {
        type: 'ente' as const,
        value: normalizeEnte(ente ?? ''),
      };
  const cacheKey = buildCrpCacheKey(query.type, query.value);
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
    const { value: extrato } = await cadPrevRequestScheduler.schedule(
      () =>
        executeWithCadPrevRetry(
          () => consultarCadPrev(cadPrevClient, query),
          cadPrevRetryClassifier,
          {
            retryAttempts: env.cadPrevRetryAttempts,
            initialBackoffMs: env.cadPrevRetryBackoffInitialMs,
            maxBackoffMs: env.cadPrevRetryBackoffMaxMs,
            jitterMs: env.cadPrevRetryJitterMs,
          },
          {
            query_type: query.type,
            query_value: query.value,
          },
        ),
      {
        query_type: query.type,
        query_value: query.value,
      },
    );
    cadPrevSourceStatus.markAvailable();
    const response: CadPrevCrpResponse = {
      fonte: 'CadPrev Público',
      url_consultada:
        query.type === 'cnpj'
          ? cadPrevClient.buildExtratoUrl(query.value)
          : cadPrevClient.buildEnteSearchUrl(),
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
    const observedError = getObservedError(error);
    const retryMetadata = getRetryMetadata(error);

    if (isTimeoutError(observedError)) {
      cadPrevSourceStatus.markUnavailable({
        code: 'CADPREV_TIMEOUT',
        message: 'O CadPrev Público não respondeu dentro do tempo limite.',
        origin: 'browser_runtime',
        possible_source_limitation: retryMetadata?.possible_source_limitation,
      });
      res.status(504).json(createCadPrevTimeoutResponse(observedError, retryMetadata));
      return;
    }

    if (isSourceUnavailableError(observedError)) {
      cadPrevSourceStatus.markUnavailable({
        code: 'CADPREV_UNAVAILABLE',
        message: 'O CadPrev Público encontra-se indisponível no momento.',
        origin: resolveUnavailableErrorOrigin(observedError),
        possible_source_limitation: retryMetadata?.possible_source_limitation,
      });
      res.status(503).json(createCadPrevUnavailableResponse(observedError, retryMetadata));
      return;
    }

    if (isUnexpectedCadPrevContentError(observedError)) {
      cadPrevSourceStatus.markDegraded({
        code: 'CADPREV_UNEXPECTED_CONTENT',
        message: 'O CadPrev Público respondeu com conteúdo insuficiente ou inesperado.',
        origin: 'official_source',
      });
      res.status(502).json(createCadPrevUnexpectedContentResponse(observedError));
      return;
    }

    if (observedError instanceof CadPrevEnteSearchAmbiguityError) {
      res.status(422).json({
        status: 'error',
        source: 'CadPrev Público',
        code: 'CADPREV_ENTE_AMBIGUOUS',
        message: 'A busca por ente no CadPrev retornou resultados ambíguos.',
        details: observedError.message,
        consultado_em: new Date().toISOString(),
      });
      return;
    }

    next(observedError);
  }
});

cadPrevRouter.get('/api/v1/cadprev/source-status', (_req, res) => {
  res.json(cadPrevSourceStatus.getSnapshot());
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

function normalizeEnte(ente: string): string {
  return ente.trim();
}

function buildCrpCacheKey(type: 'cnpj' | 'ente', value: string): string {
  return `cadprev:crp:${type}:${value.toLowerCase()}`;
}

function consultarCadPrev(
  cadPrevClient: CadPrevClient,
  query: { type: 'cnpj' | 'ente'; value: string },
): Promise<CadPrevExtrato> {
  return query.type === 'cnpj'
    ? cadPrevClient.consultarExtratoPorCnpj(query.value)
    : cadPrevClient.consultarExtratoPorEnte(query.value);
}

const cadPrevRetryClassifier = {
  getRetryReason(error: unknown): string | null {
    if (isTimeoutError(error)) {
      return 'timeout';
    }

    if (isSourceUnavailableError(error)) {
      return 'source_unavailable';
    }

    return null;
  },
  getFinalErrorCode(error: unknown): string {
    if (isTimeoutError(error)) {
      return 'CADPREV_TIMEOUT';
    }

    if (isSourceUnavailableError(error)) {
      return 'CADPREV_UNAVAILABLE';
    }

    if (error instanceof CadPrevEnteSearchAmbiguityError) {
      return 'CADPREV_ENTE_AMBIGUOUS';
    }

    if (isUnexpectedCadPrevContentError(error)) {
      return 'CADPREV_UNEXPECTED_CONTENT';
    }

    return 'CONNECTOR_INTERNAL_ERROR';
  },
};

export function createCadPrevTimeoutResponse(
  error: unknown,
  retryMetadata?: CadPrevRetryMetadata,
): CadPrevErrorResponse {
  return {
    status: 'error',
    source: 'CadPrev Público',
    code: 'CADPREV_TIMEOUT',
    message: 'O CadPrev Público não respondeu dentro do tempo limite.',
    details: error instanceof Error ? error.message : String(error),
    error_origin: 'browser_runtime',
    possible_source_limitation: retryMetadata?.possible_source_limitation,
    consultado_em: new Date().toISOString(),
  };
}

export function createCadPrevUnavailableResponse(
  error: unknown,
  retryMetadata?: CadPrevRetryMetadata,
): CadPrevErrorResponse {
  return {
    status: 'error',
    source: 'CadPrev Público',
    code: 'CADPREV_UNAVAILABLE',
    message: 'O CadPrev Público encontra-se indisponível no momento.',
    details: error instanceof Error ? error.message : String(error),
    error_origin: resolveUnavailableErrorOrigin(error),
    possible_source_limitation: retryMetadata?.possible_source_limitation,
    consultado_em: new Date().toISOString(),
  };
}

export function createCadPrevUnexpectedContentResponse(error: unknown): CadPrevErrorResponse {
  return {
    status: 'error',
    source: 'CadPrev Público',
    code: 'CADPREV_UNEXPECTED_CONTENT',
    message: 'O CadPrev Público respondeu com conteúdo insuficiente ou inesperado.',
    details: error instanceof Error ? error.message : String(error),
    error_origin: 'official_source',
    consultado_em: new Date().toISOString(),
  };
}

export function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === 'BrowserTimeoutError' || error.name === 'TimeoutError') {
    return true;
  }

  return isTimeoutError(error.cause);
}

export function isSourceUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === 'BrowserNavigationError') {
    return true;
  }

  const message = `${error.name} ${error.message}`.toLowerCase();

  if (
    message.includes('fetch failed') ||
    message.includes('err_connection_timed_out') ||
    message.includes('err_connection_refused') ||
    message.includes('err_name_not_resolved') ||
    message.includes('connect timeout') ||
    message.includes('connection timed out')
  ) {
    return true;
  }

  return isSourceUnavailableError(error.cause);
}

export function resolveUnavailableErrorOrigin(error: unknown): CadPrevUnavailableErrorOrigin {
  if (!(error instanceof Error)) {
    return 'official_source';
  }

  const message = `${error.name} ${error.message}`.toLowerCase();

  if (error.name === 'BrowserNavigationError') {
    return 'browser_runtime';
  }

  if (
    message.includes('fetch failed') ||
    message.includes('connect timeout') ||
    message.includes('connection timed out')
  ) {
    return 'connector_network';
  }

  return resolveUnavailableErrorOrigin(error.cause);
}

export function isUnexpectedCadPrevContentError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message === 'CadPrev extract did not contain the expected basic CRP data'
  );
}

function getObservedError(error: unknown): unknown {
  return error instanceof CadPrevRetryExhaustedError ? error.cause : error;
}

function getRetryMetadata(error: unknown): CadPrevRetryMetadata | undefined {
  return error instanceof CadPrevRetryExhaustedError ? error.metadata : undefined;
}
