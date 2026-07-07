import type { CadPrevCriterio, CadPrevResumo } from './CadPrevTypes.js';

const CRITERIA_HEADER_PREFIX = 'Critério(s)';
const REGULAR_STATUS = 'Regular';

export interface CadPrevCriteriaParseResult {
  resumo: CadPrevResumo;
  criterios: CadPrevCriterio[];
  criterios_irregulares: CadPrevCriterio[];
}

export class CadPrevCriteriaParser {
  public parse(pageText: string): CadPrevCriteriaParseResult {
    const criterios = parseCriteriaRows(pageText);
    const criterios_irregulares = criterios.filter(isIrregular);

    return {
      resumo: {
        situacao_crp: criterios_irregulares.length > 0 ? 'Regular com pendências' : 'Regular',
        total_criterios: criterios.length,
        total_criterios_regulares: criterios.filter(isRegular).length,
        total_criterios_irregulares: criterios_irregulares.length,
      },
      criterios,
      criterios_irregulares,
    };
  }
}

function parseCriteriaRows(pageText: string): CadPrevCriterio[] {
  const lines = pageText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const criterios: CadPrevCriterio[] = [];
  let currentGroup = '';

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const nextLine = lines[index + 1] ?? '';

    if (nextLine.startsWith(CRITERIA_HEADER_PREFIX)) {
      currentGroup = line;
      index += 1;
      continue;
    }

    if (!currentGroup || !line.includes('\t')) {
      continue;
    }

    const criterio = parseCriteriaLine(line, currentGroup);

    if (criterio) {
      criterios.push(criterio);
    }
  }

  return criterios;
}

function parseCriteriaLine(line: string, grupo: string): CadPrevCriterio | null {
  const [criterio = '', descricao = '', responsavel = '', situacao = '', decisao_judicial = ''] =
    line.split('\t').map((value) => value.trim());

  if (!criterio || !situacao) {
    return null;
  }

  return {
    grupo,
    criterio,
    descricao,
    responsavel,
    situacao,
    decisao_judicial,
  };
}

function isRegular(criterio: CadPrevCriterio): boolean {
  return criterio.situacao.toLowerCase() === REGULAR_STATUS.toLowerCase();
}

function isIrregular(criterio: CadPrevCriterio): boolean {
  return !isRegular(criterio);
}
