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
