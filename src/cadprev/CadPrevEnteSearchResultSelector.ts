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
}

const STATE_QUERIES: StateQuery[] = [
  { name: 'acre', displayName: 'Acre', article: 'do', uf: 'AC' },
  { name: 'alagoas', displayName: 'Alagoas', article: 'de', uf: 'AL' },
  { name: 'amapa', displayName: 'Amapá', article: 'do', uf: 'AP' },
  { name: 'amazonas', displayName: 'Amazonas', article: 'do', uf: 'AM' },
  { name: 'bahia', displayName: 'Bahia', article: 'da', uf: 'BA' },
  { name: 'ceara', displayName: 'Ceará', article: 'do', uf: 'CE' },
  { name: 'distrito federal', displayName: 'Distrito Federal', article: 'do', uf: 'DF' },
  { name: 'espirito santo', displayName: 'Espírito Santo', article: 'do', uf: 'ES' },
  { name: 'goias', displayName: 'Goiás', article: 'de', uf: 'GO' },
  { name: 'maranhao', displayName: 'Maranhão', article: 'do', uf: 'MA' },
  { name: 'mato grosso', displayName: 'Mato Grosso', article: 'do', uf: 'MT' },
  { name: 'mato grosso do sul', displayName: 'Mato Grosso do Sul', article: 'do', uf: 'MS' },
  { name: 'minas gerais', displayName: 'Minas Gerais', article: 'de', uf: 'MG' },
  { name: 'para', displayName: 'Pará', article: 'do', uf: 'PA' },
  { name: 'paraiba', displayName: 'Paraíba', article: 'da', uf: 'PB' },
  { name: 'parana', displayName: 'Paraná', article: 'do', uf: 'PR' },
  { name: 'pernambuco', displayName: 'Pernambuco', article: 'de', uf: 'PE' },
  { name: 'piaui', displayName: 'Piauí', article: 'do', uf: 'PI' },
  { name: 'rio de janeiro', displayName: 'Rio de Janeiro', article: 'do', uf: 'RJ' },
  { name: 'rio grande do norte', displayName: 'Rio Grande do Norte', article: 'do', uf: 'RN' },
  { name: 'rio grande do sul', displayName: 'Rio Grande do Sul', article: 'do', uf: 'RS' },
  { name: 'rondonia', displayName: 'Rondônia', article: 'de', uf: 'RO' },
  { name: 'roraima', displayName: 'Roraima', article: 'de', uf: 'RR' },
  { name: 'santa catarina', displayName: 'Santa Catarina', article: 'de', uf: 'SC' },
  { name: 'sao paulo', displayName: 'São Paulo', article: 'de', uf: 'SP' },
  { name: 'sergipe', displayName: 'Sergipe', article: 'de', uf: 'SE' },
  { name: 'tocantins', displayName: 'Tocantins', article: 'do', uf: 'TO' },
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

  if (
    normalizedText.includes(`estado do ${stateQuery.name}`) ||
    normalizedText.includes(`estado de ${stateQuery.name}`)
  ) {
    score += 30;
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
    normalizedText.includes('governo do estado') ||
    normalizedText.includes('estado de governo do estado') ||
    normalizedText.includes(`estado do ${stateQuery.name}`) ||
    normalizedText.includes(`estado de ${stateQuery.name}`)
  );
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
