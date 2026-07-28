import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { requestOrigin } from '@/lib/request-origin';

function req(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/auth/login', { headers });
}

describe('requestOrigin', () => {
  it('usa el origen del request cuando no hay cabeceras reenviadas', () => {
    expect(requestOrigin(req())).toBe('http://localhost:3000');
  });

  it('prefiere el host y el protocolo reenviados', () => {
    const origin = requestOrigin(
      req({ 'x-forwarded-host': 'horarios.vercel.app', 'x-forwarded-proto': 'https' })
    );
    expect(origin).toBe('https://horarios.vercel.app');
  });

  it('asume https cuando solo llega el host reenviado', () => {
    expect(requestOrigin(req({ 'x-forwarded-host': 'horarios.vercel.app' }))).toBe(
      'https://horarios.vercel.app'
    );
  });

  it('ignora el protocolo reenviado si no vino el host', () => {
    expect(requestOrigin(req({ 'x-forwarded-proto': 'https' }))).toBe('http://localhost:3000');
  });
});
