import { describe, expect, it, vi } from 'vitest';

const consultarExtratoPorCnpjMock = vi.hoisted(() => vi.fn<() => Promise<never>>());

vi.mock('../src/cadprev/CadPrevClient.js', () => ({
  CadPrevClient: vi.fn().mockImplementation(() => ({
    buildExtratoUrl: (cnpj: string) =>
      `https://cadprev.previdencia.gov.br/Cadprev/pages/publico/extrato/extratoExterno.xhtml?cnpj=${cnpj}`,
    buildEnteSearchUrl: () =>
      'https://cadprev.previdencia.gov.br/Cadprev/pages/publico/crp/pesquisarEnteCrp.xhtml',
    consultarExtratoPorCnpj: consultarExtratoPorCnpjMock,
  })),
}));

describe('CadPrev unexpected content response', () => {
  it('returns structured error for content without current or last CRP', async () => {
    const { createServer } = await import('../src/api/server.js');
    const { cadPrevSourceStatus } = await import('../src/cadprev/CadPrevSourceStatus.js');
    cadPrevSourceStatus.reset(new Date('2026-07-10T10:00:00.000Z'));
    consultarExtratoPorCnpjMock.mockRejectedValue(
      new Error('CadPrev extract did not contain the expected basic CRP data'),
    );
    const app = createServer();
    const server = app.listen(0);
    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve server address');
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/v1/cadprev/crp?cnpj=11222333000144`,
      );
      const body = await response.json();
      const sourceStatus = cadPrevSourceStatus.getSnapshot();

      expect(response.status).toBe(502);
      expect(body).toMatchObject({
        status: 'error',
        source: 'CadPrev Público',
        code: 'CADPREV_UNEXPECTED_CONTENT',
        error_origin: 'official_source',
      });
      expect(sourceStatus).toMatchObject({
        status: 'degraded',
        last_error: {
          code: 'CADPREV_UNEXPECTED_CONTENT',
          origin: 'official_source',
        },
      });
      expect(consultarExtratoPorCnpjMock).toHaveBeenCalledTimes(1);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      cadPrevSourceStatus.reset();
      consultarExtratoPorCnpjMock.mockReset();
    }
  });
});
