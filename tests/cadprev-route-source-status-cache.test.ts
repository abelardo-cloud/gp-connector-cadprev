import { describe, expect, it, vi } from 'vitest';
import type { CadPrevExtrato } from '../src/cadprev/CadPrevTypes.js';

const consultarExtratoPorCnpjMock = vi.hoisted(() => vi.fn<() => Promise<CadPrevExtrato>>());

vi.mock('../src/cadprev/CadPrevClient.js', () => ({
  CadPrevClient: vi.fn().mockImplementation(() => ({
    buildExtratoUrl: (cnpj: string) =>
      `https://cadprev.previdencia.gov.br/Cadprev/pages/publico/extrato/extratoExterno.xhtml?cnpj=${cnpj}`,
    buildEnteSearchUrl: () =>
      'https://cadprev.previdencia.gov.br/Cadprev/pages/publico/crp/pesquisarEnteCrp.xhtml',
    consultarExtratoPorCnpj: consultarExtratoPorCnpjMock,
  })),
}));

describe('CadPrev CRP cache and observed source status', () => {
  it('does not update last_success_at on cache hit', async () => {
    const { createServer } = await import('../src/api/server.js');
    const { cadPrevSourceStatus } = await import('../src/cadprev/CadPrevSourceStatus.js');
    cadPrevSourceStatus.reset(new Date('2026-07-10T10:00:00.000Z'));
    consultarExtratoPorCnpjMock.mockResolvedValue(createExtrato());
    const app = createServer();
    const server = app.listen(0);
    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve server address');
    }

    try {
      const url = `http://127.0.0.1:${address.port}/api/v1/cadprev/crp?cnpj=11222333000144`;
      const firstResponse = await fetch(url);
      const firstStatus = cadPrevSourceStatus.getSnapshot();
      const secondResponse = await fetch(url);
      const secondStatus = cadPrevSourceStatus.getSnapshot();
      const secondBody = await secondResponse.json();

      expect(firstResponse.status).toBe(200);
      expect(secondResponse.status).toBe(200);
      expect(secondBody.cache.hit).toBe(true);
      expect(consultarExtratoPorCnpjMock).toHaveBeenCalledTimes(1);
      expect(secondStatus.last_success_at).toBe(firstStatus.last_success_at);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      cadPrevSourceStatus.reset();
      consultarExtratoPorCnpjMock.mockReset();
    }
  });
});

function createExtrato(): CadPrevExtrato {
  return {
    ente: 'Estado de Governo do Estado Teste - TS',
    uf: 'TS',
    cnpj: '11.222.333/0001-44',
    crp: {
      numero: '123456-000001',
      emitido_em: '01/01/2026',
      vigente_ate: '01/07/2026',
      data_pesquisa: '10/07/2026',
      is_current: true,
      lifecycle_status: 'current',
      source_label: 'CRP Vigente',
    },
    resumo: {
      situacao_crp: 'Regular',
      total_criterios: 1,
      total_criterios_regulares: 1,
      total_criterios_irregulares: 0,
    },
    criterios: [
      {
        grupo: 'Grupo',
        criterio: 'Critério',
        descricao: '',
        responsavel: 'Responsável',
        situacao: 'Regular',
        decisao_judicial: '-',
      },
    ],
    criterios_irregulares: [],
    diagnostico_base: {
      impacto: 'Não há critérios irregulares no extrato do CRP.',
      recomendacao: 'Manter o acompanhamento periódico da situação do CRP no CadPrev.',
    },
  };
}
