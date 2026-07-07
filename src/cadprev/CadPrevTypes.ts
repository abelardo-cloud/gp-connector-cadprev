export interface CadPrevCrp {
  numero: string;
  emitido_em: string;
  vigente_ate: string;
  data_pesquisa: string;
}

export interface CadPrevCriterio {
  grupo: string;
  criterio: string;
  descricao: string;
  responsavel: string;
  situacao: string;
  decisao_judicial: string;
}

export interface CadPrevResumo {
  situacao_crp: string;
  total_criterios: number;
  total_criterios_regulares: number;
  total_criterios_irregulares: number;
}

export interface CadPrevDiagnosticoBase {
  impacto: string;
  recomendacao: string;
}

export interface CadPrevCacheInfo {
  hit: boolean;
  ttl_seconds: number;
}

export interface CadPrevExtrato {
  ente: string;
  uf: string;
  cnpj: string;
  crp: CadPrevCrp;
  resumo: CadPrevResumo;
  criterios: CadPrevCriterio[];
  criterios_irregulares: CadPrevCriterio[];
  diagnostico_base: CadPrevDiagnosticoBase;
}

export interface CadPrevCrpResponse extends CadPrevExtrato {
  fonte: 'CadPrev Público';
  url_consultada: string;
  cache: CadPrevCacheInfo;
  consultado_em: string;
}

export interface CadPrevErrorResponse {
  status: 'error';
  source: 'CadPrev Público';
  code: 'CADPREV_TIMEOUT';
  message: string;
  details: string;
  consultado_em: string;
}
