import { describe, it, expect } from 'vitest';
import { ALLOWED_EMAIL_DOMAIN, isAllowedEmail } from '@/lib/auth-domain';

describe('isAllowedEmail', () => {
  it('acepta un correo del dominio institucional', () => {
    expect(isAllowedEmail('luis.maquera@utec.edu.pe')).toBe(true);
  });

  it('ignora mayúsculas y espacios sobrantes', () => {
    expect(isAllowedEmail('Luis.Maquera@UTEC.EDU.PE')).toBe(true);
    expect(isAllowedEmail('luis@utec.edu.pe  ')).toBe(true);
  });

  it('rechaza correos vacíos o ausentes', () => {
    expect(isAllowedEmail('')).toBe(false);
    expect(isAllowedEmail(undefined)).toBe(false);
    expect(isAllowedEmail(null)).toBe(false);
  });

  it('rechaza una cadena sin @', () => {
    expect(isAllowedEmail('utec.edu.pe')).toBe(false);
  });

  it('rechaza otros dominios', () => {
    expect(isAllowedEmail('alguien@gmail.com')).toBe(false);
  });

  // Los dos casos que un `endsWith` dejaría pasar.
  it('rechaza un dominio que solo termina igual', () => {
    expect(isAllowedEmail('alguien@notutec.edu.pe')).toBe(false);
  });

  it('rechaza el dominio usado como prefijo de otro', () => {
    expect(isAllowedEmail('alguien@utec.edu.pe.evil.com')).toBe(false);
  });

  it('rechaza subdominios: la allowlist es de dominio exacto', () => {
    expect(isAllowedEmail('alguien@alumno.utec.edu.pe')).toBe(false);
  });

  it('toma el dominio después de la última @', () => {
    expect(isAllowedEmail('"a@utec.edu.pe"@evil.com')).toBe(false);
    expect(isAllowedEmail('"a@evil.com"@utec.edu.pe')).toBe(true);
  });

  it('expone el dominio permitido', () => {
    expect(ALLOWED_EMAIL_DOMAIN).toBe('utec.edu.pe');
  });
});
