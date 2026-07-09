export interface CadPrevEnteSearchResult {
  rowIndex: number;
  uf: string;
  ente: string;
  text: string;
}

export class CadPrevEnteSearchAmbiguityError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'CadPrevEnteSearchAmbiguityError';
  }
}

interface StateQuery {
  name: string;
  displayName: string;
  article: 'da' | 'de' | 'do';
  uf: string;
  acceptedForms: string[];
}

const STATE_QUERIES: StateQuery[] = [
  createStateQuery('Acre', 'AC', 'do'),
  createStateQuery('Alagoas', 'AL', 'de'),
  createStateQuery('Amapá', 'AP', 'do'),
  createStateQuery('Amazonas', 'AM', 'do'),
  createStateQuery('Bahia', 'BA', 'da', ['Estado de Bahia']),
  createStateQuery('Ceará', 'CE', 'do'),
  createStateQuery('Distrito Federal', 'DF', 'do', [
    'Distrito Federal',
    'Governo do Distrito Federal',
  ]),
  createStateQuery('Espírito Santo', 'ES', 'do'),
  createStateQuery('Goiás', 'GO', 'de'),
  createStateQuery('Maranhão', 'MA', 'do'),
  createStateQuery('Mato Grosso', 'MT', 'do'),
  createStateQuery('Mato Grosso do Sul', 'MS', 'do'),
  createStateQuery('Minas Gerais', 'MG', 'de'),
  createStateQuery('Pará', 'PA', 'do', ['Estado de Pará']),
  createStateQuery('Paraíba', 'PB', 'da', ['Estado de Paraíba']),
  createStateQuery('Paraná', 'PR', 'do'),
  createStateQuery('Pernambuco', 'PE', 'de'),
  createStateQuery('Piauí', 'PI', 'do'),
  createStateQuery('Rio de Janeiro', 'RJ', 'do'),
  createStateQuery('Rio Grande do Norte', 'RN', 'do'),
  createStateQuery('Rio Grande do Sul', 'RS', 'do'),
  createStateQuery('Rondônia', 'RO', 'de'),
  createStateQuery('Roraima', 'RR', 'de'),
  createStateQuery('Santa Catarina', 'SC', 'de'),
  createStateQuery('São Paulo', 'SP', 'de'),
  createStateQuery('Sergipe', 'SE', 'de'),
  createStateQuery('Tocantins', 'TO', 'do'),
];

export function selectBestEnteSearchResult(
  results: CadPrevEnteSearchResult[],
  query: string,
): CadPrevEnteSearchResult {
  const normalizedQuery = normalizeSearchText(query);
  const stateQuery = resolveStateQuery(normalizedQuery);

  if (stateQuery) {
    return selectStateResult(results, stateQuery, query);
  }

  return selectNonStateResult(results, normalizedQuery, query);
}

export function getStateSearchFallbackQueries(query: string): string[] {
  const stateQuery = resolveStateQuery(normalizeSearchText(query));

  if (!stateQuery) {
    return [];
  }

  return [
    `Estado de Governo do Estado ${stateQuery.article} ${stateQuery.displayName}`,
    `Governo do Estado ${stateQuery.article} ${stateQuery.displayName}`,
    `Estado ${stateQuery.article} ${stateQuery.displayName}`,
  ];
}

function selectStateResult(
  results: CadPrevEnteSearchResult[],
  stateQuery: StateQuery,
  originalQuery: string,
): CadPrevEnteSearchResult {
  const candidates = results
    .filter((result) => result.uf.toUpperCase() === stateQuery.uf)
    .filter((result) => !isMunicipalResult(result))
    .filter((result) => isStateResult(result, stateQuery))
    .map((result) => ({
      result,
      score: scoreStateResult(result, stateQuery),
    }))
    .sort((left, right) => right.score - left.score);

  if (candidates.length === 0) {
    throw new CadPrevEnteSearchAmbiguityError(
      `No reliable state result found in CadPrev search for ente: ${originalQuery}`,
    );
  }

  const [bestCandidate, secondCandidate] = candidates;

  if (secondCandidate && secondCandidate.score === bestCandidate.score) {
    throw new CadPrevEnteSearchAmbiguityError(
      `Multiple state results found in CadPrev search for ente: ${originalQuery}`,
    );
  }

  return bestCandidate.result;
}

function selectNonStateResult(
  results: CadPrevEnteSearchResult[],
  normalizedQuery: string,
  originalQuery: string,
): CadPrevEnteSearchResult {
  const exactMatches = results.filter(
    (result) => normalizeSearchText(result.ente) === normalizedQuery,
  );

  if (exactMatches.length === 1) {
    return exactMatches[0];
  }

  if (exactMatches.length > 1) {
    throw new CadPrevEnteSearchAmbiguityError(
      `Multiple exact results found in CadPrev search for ente: ${originalQuery}`,
    );
  }

  const containsMatches = results.filter((result) =>
    normalizeSearchText(result.ente).includes(normalizedQuery),
  );

  if (containsMatches.length === 1) {
    return containsMatches[0];
  }

  throw new CadPrevEnteSearchAmbiguityError(
    `Ambiguous CadPrev search results for ente: ${originalQuery}`,
  );
}

function resolveStateQuery(normalizedQuery: string): StateQuery | undefined {
  const upperQuery = normalizedQuery.toUpperCase();

  return STATE_QUERIES.find(
    (stateQuery) =>
      stateQuery.name === normalizedQuery ||
      stateQuery.uf === upperQuery ||
      (normalizedQuery.includes(stateQuery.name) &&
        (normalizedQuery.includes('estado') || normalizedQuery.includes('governo'))),
  );
}

function scoreStateResult(result: CadPrevEnteSearchResult, stateQuery: StateQuery): number {
  const normalizedText = normalizeSearchText(`${result.ente} ${result.text}`);
  let score = 0;

  if (result.uf.toUpperCase() === stateQuery.uf) {
    score += 50;
  }

  if (normalizedText.includes(`estado de governo do estado`)) {
    score += 40;
  }

  if (normalizedText.includes(`governo do estado`)) {
    score += 30;
  }

  if (stateQuery.acceptedForms.some((form) => normalizedText.includes(form))) {
    score += 30;
  }

  if (normalizedText.includes(`${stateQuery.name} - ${stateQuery.uf.toLowerCase()}`)) {
    score += 20;
  }

  if (
    normalizedText.includes(`governo do estado - ${stateQuery.uf.toLowerCase()}`) ||
    normalizedText.includes(`governo do estado ${stateQuery.uf.toLowerCase()}`)
  ) {
    score += 20;
  }

  if (normalizedText.includes(stateQuery.name)) {
    score += 10;
  }

  return score;
}

function isMunicipalResult(result: CadPrevEnteSearchResult): boolean {
  return normalizeSearchText(`${result.ente} ${result.text}`).includes('municipio de');
}

function isStateResult(result: CadPrevEnteSearchResult, stateQuery: StateQuery): boolean {
  const normalizedText = normalizeSearchText(`${result.ente} ${result.text}`);

  return (
    stateQuery.acceptedForms.some((form) => normalizedText.includes(form)) ||
    normalizedText.includes(`${stateQuery.name} - ${stateQuery.uf.toLowerCase()}`) ||
    normalizedText.includes(`governo do estado - ${stateQuery.uf.toLowerCase()}`) ||
    normalizedText.includes(`governo do estado ${stateQuery.uf.toLowerCase()}`)
  );
}

function createStateQuery(
  displayName: string,
  uf: string,
  article: StateQuery['article'],
  extraAcceptedForms: string[] = [],
): StateQuery {
  const name = normalizeSearchText(displayName);
  const acceptedForms = [
    displayName,
    `${displayName} - ${uf}`,
    `Estado ${article} ${displayName}`,
    `Estado de ${displayName}`,
    `Estado do ${displayName}`,
    `Estado da ${displayName}`,
    `Governo do Estado ${article} ${displayName}`,
    `Governo do Estado - ${uf}`,
    `Estado de Governo do Estado ${article} ${displayName}`,
    `Estado de Governo do Estado de ${displayName}`,
    `Estado de Governo do Estado do ${displayName}`,
    `Estado de Governo do Estado da ${displayName}`,
    ...extraAcceptedForms,
  ].map(normalizeSearchText);

  return {
    name,
    displayName,
    article,
    uf,
    acceptedForms: [...new Set(acceptedForms)],
  };
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
