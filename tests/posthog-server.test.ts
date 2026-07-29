import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getPostHogClient } from '@/lib/posthog-server';

/**
 * Imita el cliente de posthog-node: nada de esto debe tocar la red, solo
 * importa que `getPostHogClient` le pase la key y el host correctos.
 */
const { PostHogMock } = vi.hoisted(() => ({
  PostHogMock: vi.fn(function (this: unknown, key: string, options: unknown) {
    Object.assign(this as object, { key, options });
  }),
}));

vi.mock('posthog-node', () => ({
  PostHog: PostHogMock,
}));

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', undefined);
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', undefined);
  PostHogMock.mockClear();
});

describe('getPostHogClient', () => {
  it('lanza si falta el token o el host', () => {
    expect(() => getPostHogClient()).toThrow(/NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN/);
  });

  it('construye el cliente con el token y el host configurados', () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'phc_test');
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://us.i.posthog.com');

    getPostHogClient();

    expect(PostHogMock).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({ host: 'https://us.i.posthog.com' })
    );
  });

  // El cliente abre una conexión por evento; reusar la instancia es lo que
  // evita abrir una nueva por cada `capture` de un mismo request.
  it('reusa la misma instancia entre llamadas', () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'phc_test');
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://us.i.posthog.com');

    const first = getPostHogClient();
    const second = getPostHogClient();

    expect(second).toBe(first);
  });
});
