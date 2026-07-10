import { describe, expect, it, vi } from 'vitest';
import type { CadPrevExtrato } from '../src/cadprev/CadPrevTypes.js';

const consultarExtratoPorEnteMock = vi.hoisted(() => vi.fn<() => Promise<CadPrevExtrato>>());

vi.mock('../src/cadprev/CadPrevClient.js', () => ({
  CadPrevClient: vi.fn().mockImplementation(() => ({
    buildExtratoUrl: (cnpj: string) =>
      `https://cadprev.previdencia.gov.br/Cadprev/pages/publico/extrato/extratoExterno.xhtml?cnpj=${cnpj}`,
    buildEnteSearchUrl: () =>
      'https://cadprev.previdencia.gov.br/Cadprev/pages/publico/crp/pesquisarEnteCrp.xhtml',
    consultarExtratoPorEnte: consultarExtratoPorEnteMock,
  })),
}));

describe('CadPrev CRP route by Ceará ente', () => {
  it('returns the Ceará last CRP without retrying deterministic successful selection', async () => {
    const { createServer } = await import('../src/api/server.js');
    const { cadPrevSourceStatus } = await import('../src/cadprev/CadPrevSourceStatus.js');
    cadPrevSourceStatus.reset(new Date('2026-07-10T10:00:00.000Z'));
    consultarExtratoPorEnteMock.mockResolvedValue(createCearaExtrato());
    const app = createServer();
    const server = app.listen(0);
    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve server address');
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/v1/cadprev/crp?ente=${encodeURIComponent('Ceará')}`,
      );
      const body = await response.json();
      const sourceStatus = cadPrevSourceStatus.getSnapshot();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        ente: 'Estado de Governo do Estado do Ceará - CE',
        uf: 'CE',
        cnpj: '07.954.480/0001-79',
        crp: {
          numero: '943001-250083',
          emitido_em: '29/12/2025',
          vigente_ate: '27/06/2026',
          is_current: false,
          lifecycle_status: 'expired',
          source_label: 'Último CRP',
        },
      });
      expect(sourceStatus).toMatchObject({
        status: 'available',
        last_error: null,
      });
      expect(consultarExtratoPorEnteMock).toHaveBeenCalledTimes(1);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      cadPrevSourceStatus.reset();
      consultarExtratoPorEnteMock.mockReset();
    }
  });
});

function createCearaExtrato(): CadPrevExtrato {
  return {
    ente: 'Estado de Governo do Estado do Ceará - CE',
    uf: 'CE',
    cnpj: '07.954.480/0001-79',
    crp: {
      numero: '943001-250083',
      emitido_em: '29/12/2025',
      vigente_ate: '27/06/2026',
      data_pesquisa: '10/07/2026',
      is_current: false,
      lifecycle_status: 'expired',
      source_label: 'Último CRP',
    },
    resumo: {
      situacao_crp: 'Regular com pendências',
      total_criterios: 22,
      total_criterios_regulares: 21,
      total_criterios_irregulares: 1,
    },
    criterios: [],
    criterios_irregulares: [],
    diagnostico_base: {
      impacto: 'Há critérios irregulares no extrato do CRP.',
      recomendacao: 'Avaliar os critérios irregulares indicados pelo CadPrev.',
    },
  };
}
