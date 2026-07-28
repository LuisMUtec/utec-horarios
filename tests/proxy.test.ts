import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { RATE_LIMIT } from '@/lib/rate-limit';
import { proxy, config } from '@/proxy';

/**
 * El proxy compone rate limit + refresco de sesión. Por defecto los tests corren
 * sin las variables de Supabase (el caso del job `build` del CI), donde el
 * refresco sale temprano; el que sí las define usa el cliente mockeado de abajo,
 * así que ninguna prueba toca la red.
 *
 * El contador del rate limit vive a nivel de módulo y se comparte entre tests:
 * por eso cada uno usa su propia IP.
 */

const COOKIE = { name: 'sb-proyecto-auth-token', value: 'refrescado', options: { path: '/' } };
const CACHE_HEADERS = { 'cache-control': 'private, no-store, max-age=0' };

// Imita lo único que nos importa del cliente: que al refrescar llame a `setAll`
// con las cookies nuevas y las cabeceras anti-caché.
vi.mock('@supabase/ssr', () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: { cookies: { setAll: (cookies: unknown[], headers: Record<string, string>) => void } }
  ) => ({
    auth: {
      getClaims: async () => {
        options.cookies.setAll([COOKIE], CACHE_HEADERS);
        return { data: null, error: null };
      },
    },
  }),
}));

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

  it('no aplica el límite a rutas que solo empiezan igual que /api', async () => {
    for (let i = 0; i <= RATE_LIMIT; i++) {
      await proxy(req('/api-docs', { 'x-forwarded-for': '203.0.113.4' }));
    }

    const response = await proxy(req('/api-docs', { 'x-forwarded-for': '203.0.113.4' }));
    expect(response.status).toBe(200);
  });
});

describe('proxy con Supabase configurado', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://proyecto.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  });

  it('propaga a la respuesta las cookies refrescadas', async () => {
    const response = await proxy(req('/'));
    expect(response.cookies.get(COOKIE.name)?.value).toBe(COOKIE.value);
  });

  it('propaga las cabeceras anti-caché', async () => {
    // Sin esto un CDN podría cachear la respuesta y servirle la sesión de
    // alguien a otra persona.
    const response = await proxy(req('/'));
    expect(response.headers.get('cache-control')).toBe(CACHE_HEADERS['cache-control']);
  });

  it('el 429 del rate limit corta antes de refrescar la sesión', async () => {
    for (let i = 0; i <= RATE_LIMIT; i++) {
      await proxy(req('/api/parse-pdf', { 'x-forwarded-for': '203.0.113.5' }));
    }

    const response = await proxy(req('/api/parse-pdf', { 'x-forwarded-for': '203.0.113.5' }));
    expect(response.status).toBe(429);
    expect(response.cookies.get(COOKIE.name)).toBeUndefined();
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
