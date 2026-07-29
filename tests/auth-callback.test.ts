import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/auth/callback/route';
import { createClient } from '@/lib/supabase/server';
import { getPostHogClient } from '@/lib/posthog-server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/posthog-server', () => ({ getPostHogClient: vi.fn() }));

const clientMock = vi.mocked(createClient);
const posthogMock = vi.mocked(getPostHogClient);

const exchangeCodeForSession = vi.fn();
const getClaims = vi.fn();
const signOut = vi.fn();

function fakeSupabase() {
  return {
    auth: { exchangeCodeForSession, getClaims, signOut },
  } as unknown as Awaited<ReturnType<typeof createClient>>;
}

function req(query: string) {
  return new NextRequest(`http://localhost:3000/auth/callback${query}`);
}

function fakePostHog() {
  const capture = vi.fn();
  const identify = vi.fn();
  const flush = vi.fn().mockResolvedValue(undefined);
  return { capture, identify, flush } as unknown as ReturnType<typeof getPostHogClient>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://horarios.utec.edu.pe');
  clientMock.mockResolvedValue(fakeSupabase());
});

describe('GET /auth/callback', () => {
  it('un error de OAuth captura login_failed y redirige a /auth/error', async () => {
    const ph = fakePostHog();
    posthogMock.mockReturnValue(ph);

    const response = await GET(req('?error=access_denied&error_description=Cancelado'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/auth/error?error=Cancelado');
    expect(ph.capture).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'login_failed', properties: { reason: 'oauth_error' } })
    );
  });

  it('sin código redirige a /auth/error sin tocar PostHog', async () => {
    const response = await GET(req(''));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/auth/error');
    expect(posthogMock).not.toHaveBeenCalled();
  });

  it('un error al canjear el código captura login_failed', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error('boom') });
    const ph = fakePostHog();
    posthogMock.mockReturnValue(ph);

    const response = await GET(req('?code=abc'));

    expect(response.status).toBe(307);
    expect(ph.capture).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'login_failed', properties: { reason: 'exchange_error' } })
    );
  });

  it('un correo fuera del dominio institucional cierra sesión y captura login_failed', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    getClaims.mockResolvedValue({ data: { claims: { sub: 'u1', email: 'alguien@gmail.com' } } });
    const ph = fakePostHog();
    posthogMock.mockReturnValue(ph);

    const response = await GET(req('?code=abc'));

    expect(signOut).toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(ph.capture).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'login_failed', properties: { reason: 'domain_not_allowed' } })
    );
  });

  it('un login exitoso identifica al estudiante y captura login_completed', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    getClaims.mockResolvedValue({
      data: { claims: { sub: 'u1', email: 'alumno@utec.edu.pe' } },
    });
    const ph = fakePostHog();
    posthogMock.mockReturnValue(ph);

    const response = await GET(req('?code=abc'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://horarios.utec.edu.pe/');
    expect(ph.identify).toHaveBeenCalledWith({
      distinctId: 'u1',
      properties: { email: 'alumno@utec.edu.pe' },
    });
    expect(ph.capture).toHaveBeenCalledWith({ distinctId: 'u1', event: 'login_completed' });
  });
});
