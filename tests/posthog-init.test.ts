import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const init = vi.fn();

vi.mock('posthog-js', () => ({ default: { init } }));

async function cargarInit() {
  vi.resetModules();
  return import('@/lib/posthog/init');
}

const TOKEN = 'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN';
const HOST = 'NEXT_PUBLIC_POSTHOG_HOST';

beforeEach(() => {
  vi.clearAllMocks();
  process.env[TOKEN] = 'phc_test';
  process.env[HOST] = 'https://us.i.posthog.com';
});

afterEach(() => {
  delete process.env[TOKEN];
  delete process.env[HOST];
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('initPostHog', () => {
  it('arranca con el token y el host de las variables', async () => {
    const { initPostHog } = await cargarInit();

    initPostHog();

    expect(init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({ api_host: 'https://us.i.posthog.com' })
    );
  });

  // El App Router navega sin recargar: sin esto solo contaría la primera vista
  // de cada pestaña.
  it('cuenta las vistas de las navegaciones del App Router', async () => {
    const { initPostHog } = await cargarInit();

    initPostHog();

    expect(init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({ capture_pageview: 'history_change' })
    );
  });

  it('sin las variables no arranca', async () => {
    delete process.env[TOKEN];
    const { initPostHog } = await cargarInit();

    initPostHog();

    expect(init).not.toHaveBeenCalled();
  });

  // «No llega ningún evento» se confunde con «todavía no lo probé».
  it('en desarrollo nombra la variable que falta, no la otra', async () => {
    delete process.env[HOST];
    vi.stubEnv('NODE_ENV', 'development');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { initPostHog } = await cargarInit();

    initPostHog();

    expect(error).toHaveBeenCalledOnce();
    expect(error.mock.calls[0][0]).toContain(HOST);
    expect(error.mock.calls[0][0]).not.toContain(TOKEN);
  });

  it('si faltan las dos las nombra a las dos', async () => {
    delete process.env[TOKEN];
    delete process.env[HOST];
    vi.stubEnv('NODE_ENV', 'development');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { initPostHog } = await cargarInit();

    initPostHog();

    expect(error.mock.calls[0][0]).toContain(TOKEN);
    expect(error.mock.calls[0][0]).toContain(HOST);
  });

  // En producción la app funciona sin PostHog: quedarse callado es lo correcto.
  it('en producción no ensucia la consola', async () => {
    delete process.env[TOKEN];
    vi.stubEnv('NODE_ENV', 'production');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { initPostHog } = await cargarInit();

    initPostHog();

    expect(error).not.toHaveBeenCalled();
  });
});
