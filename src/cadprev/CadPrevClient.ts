import { BrowserFactory, NavigationService } from '@govpilot/sdk';
import type { Page } from 'playwright';
import { CadPrevCriteriaParser } from './CadPrevCriteriaParser.js';
import type { CadPrevExtrato } from './CadPrevTypes.js';
import { env } from '../config/env.js';

const CADPREV_EXTRATO_URL =
  'https://cadprev.previdencia.gov.br/Cadprev/pages/publico/extrato/extratoExterno.xhtml';
const CADPREV_ENTE_SEARCH_URL =
  'https://cadprev.previdencia.gov.br/Cadprev/pages/publico/crp/pesquisarEnteCrp.xhtml';
const BODY_PREVIEW_LENGTH = 2_000;
const STEP_TIMEOUT_MS = 30_000;
const CLICK_RESULT_TIMEOUT_MS = 5_000;
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) GovPilotConnector/1.0.0 Safari/537.36';

export interface CadPrevEnteDiagnostic {
  status: 'ok' | 'error';
  url_final: string;
  title: string;
  body_preview: string;
  html_preview?: string;
  execution_time_ms: number;
  steps: string[];
  error: SerializedError | null;
}

interface SerializedError {
  name: string;
  message: string;
  details: string;
}

export class CadPrevClient {
  public buildExtratoUrl(cnpj: string): string {
    return buildExtratoUrl(normalizeCnpj(cnpj));
  }

  public buildEnteSearchUrl(): string {
    return CADPREV_ENTE_SEARCH_URL;
  }

  public async consultarExtratoPorCnpj(cnpj: string): Promise<CadPrevExtrato> {
    const normalizedCnpj = normalizeCnpj(cnpj);
    const browserEngine = BrowserFactory.create({
      timeoutMs: env.playwrightTimeoutMs,
    });

    try {
      const browser = await browserEngine.launch();
      const page = await browser.newPage({
        userAgent: DEFAULT_USER_AGENT,
        viewport: {
          width: 1280,
          height: 720,
        },
      });
      const navigation = new NavigationService(page);

      await navigation.open(this.buildExtratoUrl(normalizedCnpj), {
        waitUntil: 'domcontentloaded',
        timeoutMs: env.playwrightTimeoutMs,
      });
      await navigation.waitForSelector('body', {
        timeoutMs: env.playwrightTimeoutMs,
      });
      await page
        .locator('body', {
          hasText: /CRP Vigente|Extrato externo dos regimes previdenciários|CADPREV/,
        })
        .waitFor({
          timeout: env.playwrightTimeoutMs,
        });

      const pageText = await page.locator('body').innerText({
        timeout: env.playwrightTimeoutMs,
      });

      return extractBasicCrpData(pageText);
    } finally {
      await browserEngine.close();
    }
  }

  public async consultarExtratoPorEnte(ente: string): Promise<CadPrevExtrato> {
    const browserEngine = BrowserFactory.create({
      timeoutMs: env.playwrightTimeoutMs,
    });

    try {
      const browser = await browserEngine.launch();
      const page = await browser.newPage(createPageOptions());
      const navigation = new NavigationService(page);
      const steps: string[] = [];

      await openExtratoByEnte(page, navigation, ente, steps);

      const pageText = await page.locator('body').innerText({
        timeout: getStepTimeout(),
      });

      return extractBasicCrpData(pageText);
    } finally {
      await browserEngine.close();
    }
  }

  public async diagnosticarBuscaPorEnte(ente: string): Promise<CadPrevEnteDiagnostic> {
    const startedAt = Date.now();
    const browserEngine = BrowserFactory.create({
      timeoutMs: env.playwrightTimeoutMs,
    });
    const steps: string[] = [];
    let page: Page | undefined;

    try {
      const browser = await browserEngine.launch();
      page = await browser.newPage(createPageOptions());
      const navigation = new NavigationService(page);

      await openExtratoByEnte(page, navigation, ente, steps);

      const bodyText = await page.locator('body').innerText({
        timeout: getStepTimeout(),
      });

      return {
        status: 'ok',
        url_final: page.url(),
        title: await page.title(),
        body_preview: bodyText.slice(0, BODY_PREVIEW_LENGTH),
        execution_time_ms: Date.now() - startedAt,
        steps,
        error: null,
      };
    } catch (error) {
      const bodyPreview = page
        ? await page
            .locator('body')
            .innerText({
              timeout: getStepTimeout(),
            })
            .then((bodyText) => bodyText.slice(0, BODY_PREVIEW_LENGTH))
            .catch(() => '')
        : '';
      const htmlPreview = page
        ? await page.content().then(createHtmlPreview).catch(() => '')
        : '';

      return {
        status: 'error',
        url_final: page?.url() ?? '',
        title: page ? await page.title().catch(() => '') : '',
        body_preview: bodyPreview,
        html_preview: htmlPreview,
        execution_time_ms: Date.now() - startedAt,
        steps,
        error: serializeError(error),
      };
    } finally {
      await browserEngine.close();
    }
  }
}

function createPageOptions() {
  return {
    userAgent: DEFAULT_USER_AGENT,
    viewport: {
      width: 1280,
      height: 720,
    },
  };
}

async function openExtratoByEnte(
  page: Page,
  navigation: NavigationService,
  ente: string,
  steps: string[],
): Promise<void> {
  const normalizedEnte = normalizeText(ente);

  if (!normalizedEnte) {
    throw new Error('Ente must be informed');
  }

  steps.push('open-search-page');
  await navigation.open(CADPREV_ENTE_SEARCH_URL, {
    waitUntil: 'domcontentloaded',
    timeoutMs: env.playwrightTimeoutMs,
  });

  steps.push('wait-search-form');
  await page
    .locator('body', {
      hasText: /Pesquisar Ente|Ente/i,
    })
    .waitFor({
      timeout: getStepTimeout(),
    });

  steps.push('fill-ente');
  await fillEnteSearchField(page, ente);

  steps.push('submit-search');
  await submitEnteSearch(page);

  steps.push('wait-search-result');
  await page
    .locator('body', {
      hasText: new RegExp(escapeRegExp(ente), 'i'),
    })
    .waitFor({
      timeout: getStepTimeout(),
    });

  if (await isExtratoLoaded(page)) {
    steps.push('extract-loaded-after-search');
    return;
  }

  steps.push('click-result');
  await clickEnteSearchResult(page, ente);

  if (await isCrpListPage(page)) {
    steps.push('click-crp-row');
    await clickCrpListResult(page);
  }

  if (!(await isExtratoLoaded(page))) {
    steps.push('resolve-cnpj-from-crp');
    const cnpj = await extractCnpjFromCurrentPage(page);

    steps.push('open-extrato-by-resolved-cnpj');
    await page.goto(buildExtratoUrl(normalizeCnpj(cnpj)), {
      waitUntil: 'domcontentloaded',
      timeout: env.playwrightTimeoutMs,
    });
  }

  steps.push('wait-extrato');
  await waitForExtrato(page);
}

async function fillEnteSearchField(page: Page, ente: string): Promise<void> {
  const field = page.locator('#form\\:nmEnte, input[name="form:nmEnte"], input[id$="nmEnte"]').first();

  await field.fill(ente, {
    timeout: getStepTimeout(),
  });
}

async function submitEnteSearch(page: Page): Promise<void> {
  const searchButton = page
    .locator('input[type="submit"][value="Pesquisar"], button:has-text("Pesquisar")')
    .first();

  await Promise.allSettled([
    page.waitForLoadState('domcontentloaded', {
      timeout: getStepTimeout(),
    }),
    searchButton.click({
      timeout: getStepTimeout(),
    }),
  ]);
}

async function clickEnteSearchResult(page: Page, ente: string): Promise<void> {
  const matchingRows = page.locator('tr', {
    hasText: new RegExp(escapeRegExp(ente), 'i'),
  });
  const rowCount = Math.min(await matchingRows.count(), 3);

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const row = matchingRows.nth(rowIndex);
    const actions = row.locator('a, input[type="submit"], button, [onclick], img, span');
    const actionCount = Math.min(await actions.count(), 5);

    for (let actionIndex = 0; actionIndex < actionCount; actionIndex += 1) {
      try {
        await actions.nth(actionIndex).click({
          timeout: getStepTimeout(),
        });
        await Promise.allSettled([
          page.waitForLoadState('domcontentloaded', {
            timeout: getStepTimeout(),
          }),
          waitForExtrato(page, CLICK_RESULT_TIMEOUT_MS),
        ]);
        if ((await isExtratoLoaded(page)) || (await isCrpListPage(page))) {
          return;
        }
      } catch {
        // Try the next actionable element in the matching result row.
      }
    }

    try {
      await row.locator('td').last().click({
        timeout: getStepTimeout(),
      });
      await Promise.allSettled([
        page.waitForLoadState('domcontentloaded', {
          timeout: getStepTimeout(),
        }),
        waitForExtrato(page, CLICK_RESULT_TIMEOUT_MS),
      ]);
      if ((await isExtratoLoaded(page)) || (await isCrpListPage(page))) {
        return;
      }
    } catch {
      // Try the next matching row.
    }
  }

  throw new Error(`CadPrev search result not found for ente: ${ente}`);
}

async function clickCrpListResult(page: Page): Promise<void> {
  const rows = page.locator('tr', {
    hasText: /\d{2}\/\d{2}\/\d{4}/,
  });
  const rowCount = Math.min(await rows.count(), 1);

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const row = rows.nth(rowIndex);
    const visualizeHref = await row
      .locator('a[href*="visualizarCrp"]')
      .first()
      .getAttribute('href')
      .catch(() => null);

    if (visualizeHref) {
      await page.goto(new URL(visualizeHref, page.url()).toString(), {
        waitUntil: 'domcontentloaded',
        timeout: getStepTimeout(),
      });
      return;
    }

    const actions = row.locator('a, input[type="submit"], button, [onclick], img, span');
    const actionCount = Math.min(await actions.count(), 5);

    for (let actionIndex = 0; actionIndex < actionCount; actionIndex += 1) {
      try {
        await actions.nth(actionIndex).click({
          timeout: getStepTimeout(),
        });
        await page.waitForLoadState('domcontentloaded', {
          timeout: getStepTimeout(),
        });
        await waitForExtrato(page, CLICK_RESULT_TIMEOUT_MS).catch(() => undefined);
        if (await isExtratoLoaded(page)) {
          return;
        }
      } catch {
        // Try the next actionable element in the CRP row.
      }
    }

    try {
      await row.locator('td').last().click({
        timeout: getStepTimeout(),
      });
      await page.waitForLoadState('domcontentloaded', {
        timeout: getStepTimeout(),
      });
      await waitForExtrato(page, CLICK_RESULT_TIMEOUT_MS).catch(() => undefined);
      if (await isExtratoLoaded(page)) {
        return;
      }
    } catch {
      // Try the next CRP row.
    }
  }

  throw new Error('CadPrev CRP row not found for selected ente');
}

async function extractCnpjFromCurrentPage(page: Page): Promise<string> {
  const bodyText = await page.locator('body').innerText({
    timeout: getStepTimeout(),
  });
  const cnpjMatch = bodyText.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);

  if (!cnpjMatch) {
    throw new Error('CNPJ not found in CadPrev CRP page');
  }

  return cnpjMatch[0];
}

async function isExtratoLoaded(page: Page): Promise<boolean> {
  const bodyText = await page.locator('body').innerText({
    timeout: getStepTimeout(),
  });

  return bodyText.includes('CRP Vigente') && bodyText.includes('Ente Federado:');
}

async function isCrpListPage(page: Page): Promise<boolean> {
  const bodyText = await page.locator('body').innerText({
    timeout: getStepTimeout(),
  });

  return bodyText.includes('CRPs do') && bodyText.includes('Emissão') && bodyText.includes('Validade');
}

async function waitForExtrato(page: Page, timeoutMs = getStepTimeout()): Promise<void> {
  await page
    .locator('body', {
      hasText: /CRP Vigente|Extrato externo dos regimes previdenciários/,
    })
    .waitFor({
      timeout: timeoutMs,
    });
}

function getStepTimeout(): number {
  return Math.min(env.playwrightTimeoutMs, STEP_TIMEOUT_MS);
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function serializeError(error: unknown): SerializedError {
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

function createHtmlPreview(html: string): string {
  const markerIndex = html.indexOf('Visualizar');

  if (markerIndex === -1) {
    return html.slice(0, 4_000);
  }

  return html.slice(Math.max(0, markerIndex - 1_000), markerIndex + 3_000);
}

function normalizeCnpj(cnpj: string): string {
  const normalizedCnpj = cnpj.replace(/\D/g, '');

  if (normalizedCnpj.length !== 14) {
    throw new Error('CNPJ must contain 14 digits');
  }

  return normalizedCnpj;
}

function buildExtratoUrl(cnpj: string): string {
  const url = new URL(CADPREV_EXTRATO_URL);
  url.searchParams.set('cnpj', cnpj);

  return url.toString();
}

function extractBasicCrpData(pageText: string): CadPrevExtrato {
  const lines = pageText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const ente = getValueAfterLabel(lines, 'Ente Federado:');
  const cnpj = getValueAfterLabel(lines, 'CNPJ Principal:');
  const crpText = getValueAfterLabel(lines, 'CRP Vigente:');
  const crp = parseCrp(crpText);
  const dataPesquisa = getValueAfterLabel(lines, 'Data Pesquisa:');
  const uf = extractUf(ente);
  const criteriaParseResult = new CadPrevCriteriaParser().parse(pageText);
  const diagnosticoBase = createDiagnosticoBase(
    criteriaParseResult.resumo.total_criterios_irregulares,
  );

  if (!ente || !cnpj || !uf || !crp.numero || !crp.emitido_em || !crp.vigente_ate) {
    throw new Error('CadPrev extract did not contain the expected basic CRP data');
  }

  return {
    ente,
    uf,
    cnpj,
    crp: {
      ...crp,
      data_pesquisa: dataPesquisa,
    },
    resumo: criteriaParseResult.resumo,
    criterios: criteriaParseResult.criterios,
    criterios_irregulares: criteriaParseResult.criterios_irregulares,
    diagnostico_base: diagnosticoBase,
  };
}

function getValueAfterLabel(lines: string[], label: string): string {
  const labelIndex = lines.findIndex((line) => line.toLowerCase() === label.toLowerCase());

  if (labelIndex === -1) {
    return '';
  }

  return lines[labelIndex + 1] ?? '';
}

function parseCrp(crpText: string): CadPrevExtrato['crp'] {
  const match = crpText.match(
    /N[ºo]\s*([\d-]+),\s*emitido em\s*(\d{2}\/\d{2}\/\d{4}),\s*estar[aá]\s+vigente até\s*(\d{2}\/\d{2}\/\d{4})/i,
  );

  return {
    numero: match?.[1] ?? '',
    emitido_em: match?.[2] ?? '',
    vigente_ate: match?.[3] ?? '',
    data_pesquisa: '',
  };
}

function extractUf(ente: string): string {
  return ente.match(/-\s*([A-Z]{2})$/)?.[1] ?? '';
}

function createDiagnosticoBase(totalCriteriosIrregulares: number): CadPrevExtrato['diagnostico_base'] {
  if (totalCriteriosIrregulares > 0) {
    return {
      impacto: 'Existem critérios irregulares no extrato do CRP.',
      recomendacao: 'Regularizar os critérios irregulares indicados pelo CadPrev.',
    };
  }

  return {
    impacto: 'Não há critérios irregulares no extrato do CRP.',
    recomendacao: 'Manter o acompanhamento periódico da situação do CRP no CadPrev.',
  };
}
