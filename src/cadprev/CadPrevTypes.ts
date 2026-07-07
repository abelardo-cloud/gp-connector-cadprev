export interface CadPrevCrp {
  numero: string;
  emissao: string;
  validade: string;
}

export interface CadPrevExtrato {
  ente: string;
  uf: string;
  cnpj: string;
  crp: CadPrevCrp;
}

export interface CadPrevCrpResponse extends CadPrevExtrato {
  fonte: 'CadPrev Público';
  url_consultada: string;
  consultado_em: string;
}
