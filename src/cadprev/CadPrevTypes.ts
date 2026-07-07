export interface CadPrevCrp {
  numero: string;
  emissao: string;
  validade: string;
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
  total_criterios: number;
  total_criterios_regulares: number;
  total_criterios_irregulares: number;
}

export interface CadPrevExtrato {
  ente: string;
  uf: string;
  cnpj: string;
  crp: CadPrevCrp;
  resumo: CadPrevResumo;
  criterios: CadPrevCriterio[];
  criterios_irregulares: CadPrevCriterio[];
}

export interface CadPrevCrpResponse extends CadPrevExtrato {
  fonte: 'CadPrev Público';
  url_consultada: string;
  consultado_em: string;
}
