import { BrowserFactory, NavigationService } from '@govpilot/sdk';
import { CadPrevCriteriaParser } from './CadPrevCriteriaParser.js';
import type { CadPrevExtrato } from './CadPrevTypes.js';

const CADPREV_EXTRATO_URL =
  'https://cadprev.previdencia.gov.br/Cadprev/pages/publico/extrato/extratoExterno.xhtml';
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) GovPilotConnector/1.0.0 Safari/537.36';

export class CadPrevClient {
  public buildExtratoUrl(cnpj: string): string {
    return buildExtratoUrl(normalizeCnpj(cnpj));
  }

  public async consultarExtratoPorCnpj(cnpj: string): Promise<CadPrevExtrato> {
    const normalizedCnpj = normalizeCnpj(cnpj);
    const browserEngine = BrowserFactory.create({
      timeoutMs: DEFAULT_TIMEOUT_MS,
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
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });
      await navigation.waitForPageReady({
        waitUntil: 'load',
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });
      await navigation.waitForSelector('body', {
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });

      const pageText = await page.locator('body').innerText({
        timeout: DEFAULT_TIMEOUT_MS,
      });

      return extractBasicCrpData(pageText);
    } finally {
      await browserEngine.close();
    }
  }
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
