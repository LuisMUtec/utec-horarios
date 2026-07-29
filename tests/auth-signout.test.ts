import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/auth/signout/route';
import { createClient } from '@/lib/supabase/server';
import { getPostHogClient } from '@/lib/posthog-server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/posthog-server', () => ({ getPostHogClient: vi.fn() }));

const clientMock = vi.mocked(createClient);
const posthogMock = vi.mocked(getPostHogClient);
const signOut = vi.fn();

function fakeSupabase(claims: Record<string, unknown> | undefined) {
  return {
    auth: {
      getClaims: () => Promise.resolve({ data: claims ? { claims } : null, error: null }),
      signOut,
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>;
}

function req() {
  return new NextRequest('http://localhost:3000/auth/signout', { method: 'POST' });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://horarios.utec.edu.pe');
});

describe('POST /auth/signout', () => {
  it('captura logout_completed con el sub de la sesión', async () => {
    clientMock.mockResolvedValue(fakeSupabase({ sub: 'u1' }));
    const capture = vi.fn();
    const flush = vi.fn().mockResolvedValue(undefined);
    posthogMock.mockReturnValue({ capture, flush } as unknown as ReturnType<typeof getPostHogClient>);

    await POST(req());

    expect(capture).toHaveBeenCalledWith({ distinctId: 'u1', event: 'logout_completed' });
    expect(flush).toHaveBeenCalled();
    expect(signOut).toHaveBeenCalled();
  });

  it('sin sesión no llama a PostHog pero igual cierra sesión', async () => {
    clientMock.mockResolvedValue(fakeSupabase(undefined));

    await POST(req());

    expect(posthogMock).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalled();
  });

  it('redirige con 303 al origen configurado', async () => {
    clientMock.mockResolvedValue(fakeSupabase(undefined));

    const response = await POST(req());

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://horarios.utec.edu.pe/');
  });

  // Un error de PostHog no puede tumbar el cierre de sesión del estudiante.
  it('si PostHog falla, cierra sesión igual', async () => {
    clientMock.mockResolvedValue(fakeSupabase({ sub: 'u1' }));
    posthogMock.mockImplementation(() => {
      throw new Error('PostHog no disponible');
    });

    const response = await POST(req());

    expect(response.status).toBe(303);
    expect(signOut).toHaveBeenCalled();
  });
});
