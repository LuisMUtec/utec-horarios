import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { requestOrigin } from '@/lib/request-origin';

function req(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/auth/login', { headers });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('requestOrigin', () => {
  it('usa el origen del request cuando no hay nada configurado', () => {
    expect(requestOrigin(req())).toBe('http://localhost:3000');
  });

  it('ignora las cabeceras reenviadas por el cliente', () => {
    // El caso que importa: si esto volviera a mirar `x-forwarded-host`, el
    // `code` de OAuth se podría desviar a un origen ajeno.
    const origin = requestOrigin(
      req({ 'x-forwarded-host': 'evil.example', 'x-forwarded-proto': 'https' })
    );
    expect(origin).toBe('http://localhost:3000');
  });

  it('prefiere el sitio configurado', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://horarios.utec.app');
    expect(requestOrigin(req({ 'x-forwarded-host': 'evil.example' }))).toBe(
      'https://horarios.utec.app'
    );
  });

  it('quita la barra final del sitio configurado', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://horarios.utec.app/');
    expect(requestOrigin(req())).toBe('https://horarios.utec.app');
  });

  it('en producción usa el dominio del proyecto, no el del deploy', () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'horarios.vercel.app');
    vi.stubEnv('VERCEL_URL', 'horarios-abc123.vercel.app');
    expect(requestOrigin(req())).toBe('https://horarios.vercel.app');
  });

  it('en previews usa la URL del deploy', () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VERCEL_URL', 'horarios-abc123.vercel.app');
    expect(requestOrigin(req())).toBe('https://horarios-abc123.vercel.app');
  });
});
