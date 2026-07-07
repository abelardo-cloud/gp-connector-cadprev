import { describe, expect, it } from 'vitest';
import { CadPrevCriteriaParser } from '../src/cadprev/CadPrevCriteriaParser.js';

describe('CadPrevCriteriaParser', () => {
  it('extracts criteria and identifies irregular items', () => {
    const pageText = [
      'Fiscalização do RPPS',
      'Critério(s)\tDescrição do Critério\tResponsáveis pela Regularização / Tipo de Providência\tSituação do Critério\tCritério Amparado por Decisão Judicial',
      'Atendimento à fiscalização\t\tPoder Executivo/Unidade Gestora do RPPS: vide Relatório de Fiscalização Impossibilitada.\tRegular\t-',
      'Requisitos para os dirigentes, membros titulares dos conselhos deliberativo e fiscal e do comitê de investimentos do RPPS\t\tPoder Executivo/Unidade Gestora do RPPS: vide notificações.\tIrregular\t-',
      'Equilíbrio Financeiro e Atuarial',
      'Critério(s)\tDescrição do Critério\tResponsáveis pela Regularização / Tipo de Providência\tSituação do Critério\tCritério Amparado por Decisão Judicial',
      'Equilíbrio Financeiro e Atuarial - Encaminhamento NTA, DRAA e resultados das análises\t\tPoderes Executivo e Legislativo/Unidade Gestora: envio de documentos anuais ou vide notificações CadPrev.\tRegular\t-',
    ].join('\n');

    const result = new CadPrevCriteriaParser().parse(pageText);

    expect(result.resumo).toEqual({
      situacao_crp: 'Regular com pendências',
      total_criterios: 3,
      total_criterios_regulares: 2,
      total_criterios_irregulares: 1,
    });
    expect(result.criterios_irregulares).toHaveLength(1);
    expect(result.criterios_irregulares[0]).toMatchObject({
      grupo: 'Fiscalização do RPPS',
      criterio:
        'Requisitos para os dirigentes, membros titulares dos conselhos deliberativo e fiscal e do comitê de investimentos do RPPS',
      situacao: 'Irregular',
      decisao_judicial: '-',
    });
  });
});
