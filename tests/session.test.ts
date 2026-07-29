import { describe, it, expect } from 'vitest';
import { accountLabel, sessionFromClaims } from '@/lib/session';

describe('accountLabel', () => {
  it('corta el correo en la arroba', () => {
    expect(accountLabel('luis.maquera@utec.edu.pe')).toBe('luis.maquera');
  });

  it('deja intacto lo que no parece un correo', () => {
    expect(accountLabel('luis')).toBe('luis');
  });

  it('un correo que empieza con arroba no queda vacío', () => {
    expect(accountLabel('@utec.edu.pe')).toBe('@utec.edu.pe');
  });
});

describe('sessionFromClaims', () => {
  it('con sub y correo hay sesión', () => {
    expect(sessionFromClaims({ sub: 'u1', email: 'alumno@utec.edu.pe' })).toEqual({
      kind: 'student',
      email: 'alumno@utec.edu.pe',
      label: 'alumno',
    });
  });

  // `sub` es la única claim que el token siempre trae: que falte el correo no
  // vuelve anónimo a nadie.
  it('sin correo hay sesión igual, con una etiqueta neutra', () => {
    expect(sessionFromClaims({ sub: 'u1' })).toEqual({
      kind: 'student',
      email: '',
      label: 'Mi cuenta',
    });
  });

  it.each([[null], [undefined], ['{}'], [42], [{}], [{ sub: '' }], [{ sub: 7 }]])(
    'sin sub es anónimo (%s)',
    (claims) => {
      expect(sessionFromClaims(claims)).toEqual({ kind: 'anonymous' });
    }
  );

  it('un correo que no es texto no rompe la etiqueta', () => {
    expect(sessionFromClaims({ sub: 'u1', email: 42 })).toEqual({
      kind: 'student',
      email: '',
      label: 'Mi cuenta',
    });
  });
});
