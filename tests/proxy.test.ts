import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { RATE_LIMIT } from '@/lib/rate-limit';
import { proxy, config } from '@/proxy';

/**
 * El proxy compone rate limit + refresco de sesión. Sin las variables de
 * Supabase (el caso del job `build` del CI) el refresco sale temprano, así que
 * ninguna prueba toca la red.
 *
 * El contador del rate limit vive a nivel de módulo y se comparte entre tests:
 * por eso cada uno usa su propia IP.
 */

function req(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', undefined);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', undefined);
});

describe('proxy', () => {
  it('deja pasar una página sin sesión', async () => {
    const response = await proxy(req('/'));
    expect(response.status).toBe(200);
  });

  it('deja pasar los requests a /api dentro del límite', async () => {
    const response = await proxy(req('/api/parse-pdf', { 'x-forwarded-for': '203.0.113.1' }));
    expect(response.status).toBe(200);
  });

  it('responde 429 cuando /api supera el límite', async () => {
    for (let i = 0; i < RATE_LIMIT; i++) {
      await proxy(req('/api/parse-pdf', { 'x-forwarded-for': '203.0.113.2' }));
    }

    const response = await proxy(req('/api/parse-pdf', { 'x-forwarded-for': '203.0.113.2' }));
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ error: expect.any(String) });
  });

  it('no aplica el límite fuera de /api', async () => {
    for (let i = 0; i <= RATE_LIMIT; i++) {
      await proxy(req('/', { 'x-forwarded-for': '203.0.113.3' }));
    }

    const response = await proxy(req('/', { 'x-forwarded-for': '203.0.113.3' }));
    expect(response.status).toBe(200);
  });
});

describe('config.matcher', () => {
  // Si el matcher deja de excluir estáticos, el proxy corre en cada asset y el
  // costo se dispara sin que falle nada más.
  const matcher = new RegExp(`^${config.matcher}$`);

  it.each(['/', '/auth/login', '/api/parse-pdf'])('cubre %s', (path) => {
    expect(matcher.test(path)).toBe(true);
  });

  it.each(['/_next/static/chunk.js', '/_next/image', '/favicon.ico', '/icon.png', '/logo.svg'])(
    'excluye %s',
    (path) => {
      expect(matcher.test(path)).toBe(false);
    }
  );
});
