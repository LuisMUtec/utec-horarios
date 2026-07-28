import { describe, it, expect, beforeEach } from 'vitest';
import {
  RATE_LIMIT,
  RATE_LIMIT_WINDOW_MS,
  getClientKey,
  isRateLimited,
  type RateLimitEntry,
} from '@/lib/rate-limit';

describe('getClientKey', () => {
  it('usa la primera IP de x-forwarded-for', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.5, 70.41.3.18' });
    expect(getClientKey(headers)).toBe('203.0.113.5');
  });

  it('recorta los espacios de la cabecera', () => {
    expect(getClientKey(new Headers({ 'x-forwarded-for': '  203.0.113.5  ' }))).toBe('203.0.113.5');
  });

  it('cae a x-real-ip cuando no hay x-forwarded-for', () => {
    expect(getClientKey(new Headers({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7');
  });

  it('cae a x-real-ip cuando x-forwarded-for viene vacío', () => {
    const headers = new Headers({ 'x-forwarded-for': '', 'x-real-ip': '198.51.100.7' });
    expect(getClientKey(headers)).toBe('198.51.100.7');
  });

  it('devuelve "unknown" sin cabeceras de IP', () => {
    expect(getClientKey(new Headers())).toBe('unknown');
  });
});

describe('isRateLimited', () => {
  let store: Map<string, RateLimitEntry>;

  beforeEach(() => {
    store = new Map();
  });

  it('deja pasar los requests dentro del límite', () => {
    for (let i = 0; i < RATE_LIMIT; i++) {
      expect(isRateLimited(store, 'ip', 0)).toBe(false);
    }
  });

  it('bloquea a partir del request que excede el límite', () => {
    for (let i = 0; i < RATE_LIMIT; i++) isRateLimited(store, 'ip', 0);
    expect(isRateLimited(store, 'ip', 0)).toBe(true);
    expect(isRateLimited(store, 'ip', 0)).toBe(true);
  });

  it('cuenta cada cliente por separado', () => {
    for (let i = 0; i <= RATE_LIMIT; i++) isRateLimited(store, 'abusivo', 0);
    expect(isRateLimited(store, 'abusivo', 0)).toBe(true);
    expect(isRateLimited(store, 'inocente', 0)).toBe(false);
  });

  it('reinicia el contador cuando pasa la ventana', () => {
    for (let i = 0; i <= RATE_LIMIT; i++) isRateLimited(store, 'ip', 0);
    expect(isRateLimited(store, 'ip', RATE_LIMIT_WINDOW_MS + 1)).toBe(false);
  });

  it('no reinicia justo en el borde de la ventana', () => {
    for (let i = 0; i < RATE_LIMIT; i++) isRateLimited(store, 'ip', 0);
    expect(isRateLimited(store, 'ip', RATE_LIMIT_WINDOW_MS)).toBe(true);
  });
});
