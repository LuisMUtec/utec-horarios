import { describe, it, expect, beforeEach } from 'vitest';
import {
  MAX_TRACKED_CLIENTS,
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

  it('reinicia justo al cumplirse la ventana', () => {
    // Con `>` el request del borde caía en la ventana vieja y regalaba uno extra.
    for (let i = 0; i <= RATE_LIMIT; i++) isRateLimited(store, 'ip', 0);
    expect(isRateLimited(store, 'ip', RATE_LIMIT_WINDOW_MS)).toBe(false);
  });

  it('sigue bloqueando un milisegundo antes del borde', () => {
    for (let i = 0; i <= RATE_LIMIT; i++) isRateLimited(store, 'ip', 0);
    expect(isRateLimited(store, 'ip', RATE_LIMIT_WINDOW_MS - 1)).toBe(true);
  });
});

describe('isRateLimited: techo de clientes', () => {
  function fill(store: Map<string, RateLimitEntry>, count: number, now: number) {
    for (let i = 0; i < count; i++) isRateLimited(store, `ip-${i}`, now);
  }

  it('no crece más allá del techo', () => {
    const store = new Map<string, RateLimitEntry>();
    fill(store, MAX_TRACKED_CLIENTS + 500, 0);
    expect(store.size).toBeLessThanOrEqual(MAX_TRACKED_CLIENTS);
  });

  it('al llegar al techo purga primero las entradas vencidas', () => {
    const store = new Map<string, RateLimitEntry>();
    fill(store, MAX_TRACKED_CLIENTS, 0);

    isRateLimited(store, 'nuevo', RATE_LIMIT_WINDOW_MS);

    // Las viejas vencieron todas, así que sobrevive solo la nueva.
    expect(store.size).toBe(1);
    expect(store.has('nuevo')).toBe(true);
  });

  it('con todas vigentes desaloja la del reinicio más antiguo', () => {
    const store = new Map<string, RateLimitEntry>();
    isRateLimited(store, 'la-mas-vieja', 0);
    fill(store, MAX_TRACKED_CLIENTS - 1, 1);

    isRateLimited(store, 'nuevo', 2);

    expect(store.has('la-mas-vieja')).toBe(false);
    expect(store.has('nuevo')).toBe(true);
    expect(store.size).toBe(MAX_TRACKED_CLIENTS);
  });

  it('no desaloja a un cliente que ya está en el mapa', () => {
    const store = new Map<string, RateLimitEntry>();
    fill(store, MAX_TRACKED_CLIENTS, 0);

    isRateLimited(store, 'ip-0', 1);

    expect(store.size).toBe(MAX_TRACKED_CLIENTS);
    expect(store.get('ip-0')?.count).toBe(2);
  });
});
