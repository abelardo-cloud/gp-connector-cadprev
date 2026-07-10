import { describe, expect, it } from 'vitest';
import { parseCrp } from '../src/cadprev/CadPrevClient.js';

describe('parseCrp', () => {
  it('parses current CRP and marks it as current', () => {
    const crp = parseCrp(
      'Nº 931001-252320, emitido em 12/03/2026, estará vigente até 08/09/2026.',
      'CRP Vigente',
    );

    expect(crp).toMatchObject({
      numero: '931001-252320',
      emitido_em: '12/03/2026',
      vigente_ate: '08/09/2026',
      is_current: true,
      lifecycle_status: 'current',
      source_label: 'CRP Vigente',
    });
  });

  it('parses Ceará last CRP and marks it as expired', () => {
    const crp = parseCrp(
      'Nº 943001-250083, emitido em 29/12/2025. Esteve vigente até 27/06/2026.',
      'Último CRP',
    );

    expect(crp).toMatchObject({
      numero: '943001-250083',
      emitido_em: '29/12/2025',
      vigente_ate: '27/06/2026',
      is_current: false,
      lifecycle_status: 'expired',
      source_label: 'Último CRP',
    });
  });

  it('parses Rio de Janeiro last CRP and marks it as expired', () => {
    const crp = parseCrp(
      'Nº 953001-242556, emitido em 08/04/2025. Esteve vigente até 05/10/2025.',
      'Último CRP',
    );

    expect(crp).toMatchObject({
      numero: '953001-242556',
      emitido_em: '08/04/2025',
      vigente_ate: '05/10/2025',
      is_current: false,
      lifecycle_status: 'expired',
      source_label: 'Último CRP',
    });
  });

  it('does not accept incomplete CRP text as valid', () => {
    const crp = parseCrp('Nº 943001-250083, emitido em 29/12/2025.', 'Último CRP');

    expect(crp.numero).toBe('');
    expect(crp.emitido_em).toBe('');
    expect(crp.vigente_ate).toBe('');
    expect(crp.is_current).toBe(false);
    expect(crp.lifecycle_status).toBe('expired');
    expect(crp.source_label).toBe('Último CRP');
  });
});
