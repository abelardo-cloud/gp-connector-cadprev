import { describe, expect, it } from 'vitest';
import {
  CadPrevEnteSearchAmbiguityError,
  getStateSearchFallbackQueries,
  selectBestEnteSearchResult,
  type CadPrevEnteSearchResult,
} from '../src/cadprev/CadPrevEnteSearchResultSelector.js';

describe('selectBestEnteSearchResult', () => {
  it.each([
    {
      query: 'Acre',
      uf: 'AC',
      municipality: 'Município de Acrelândia',
      state: 'Estado de Governo do Estado do Acre',
    },
    {
      query: 'Alagoas',
      uf: 'AL',
      municipality: 'Município de Estrela de Alagoas',
      state: 'Estado de Governo do Estado de Alagoas',
    },
    {
      query: 'Pará',
      uf: 'PA',
      municipality: 'Município de Morpará',
      state: 'Estado de Governo do Estado do Pará',
    },
    {
      query: 'Piauí',
      uf: 'PI',
      municipality: 'Município de Alagoinha do Piauí',
      state: 'Estado de Governo do Estado do Piauí',
    },
    {
      query: 'São Paulo',
      uf: 'SP',
      municipality: 'Município de São Paulo de Olivença',
      state: 'Estado de Governo do Estado de São Paulo',
    },
  ])('selects the state result for $query', ({ query, uf, municipality, state }) => {
    const selected = selectBestEnteSearchResult(
      [
        createResult(0, uf, municipality),
        createResult(1, uf, state),
      ],
      query,
    );

    expect(selected.ente).toBe(state);
    expect(selected.ente).not.toBe(municipality);
    expect(selected.uf).toBe(uf);
  });

  it('rejects municipal results when the query is a known state', () => {
    expect(() =>
      selectBestEnteSearchResult([createResult(0, 'AC', 'Município de Acrelândia')], 'Acre'),
    ).toThrow(CadPrevEnteSearchAmbiguityError);
  });

  it('builds official state fallback queries', () => {
    expect(getStateSearchFallbackQueries('Piauí')).toContain(
      'Estado de Governo do Estado do Piauí',
    );
  });

  it('selects state result when the query uses the official CadPrev state label', () => {
    const selected = selectBestEnteSearchResult(
      [createResult(0, 'PI', 'Estado de Governo do Estado do Piauí')],
      'Estado de Governo do Estado do Piauí',
    );

    expect(selected.ente).toBe('Estado de Governo do Estado do Piauí');
    expect(selected.uf).toBe('PI');
  });

  it('selects a municipality for a non-state exact query', () => {
    const selected = selectBestEnteSearchResult(
      [createResult(0, 'AC', 'Município de Acrelândia')],
      'Município de Acrelândia',
    );

    expect(selected.ente).toBe('Município de Acrelândia');
  });

  it('returns a controlled error when a non-state query is ambiguous', () => {
    expect(() =>
      selectBestEnteSearchResult(
        [
          createResult(0, 'SC', 'Município de Santa Cecília'),
          createResult(1, 'RS', 'Município de Santa Maria'),
        ],
        'Santa',
      ),
    ).toThrow(CadPrevEnteSearchAmbiguityError);
  });
});

function createResult(rowIndex: number, uf: string, ente: string): CadPrevEnteSearchResult {
  return {
    rowIndex,
    uf,
    ente,
    text: `${uf}\t${ente}\tSelecionar`,
  };
}
