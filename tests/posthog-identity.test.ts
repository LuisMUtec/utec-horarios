import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const identify = vi.fn();
const reset = vi.fn();

vi.mock('posthog-js', () => ({ default: { identify, reset } }));

/**
 * El módulo recuerda a quién identificó en una variable de módulo, así que cada
 * caso necesita una copia limpia. Importarlo acá dentro también deja fijar las
 * variables de entorno antes de la primera lectura.
 */
async function cargarIdentity() {
  vi.resetModules();
  return import('@/lib/posthog/identity');
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
});

describe('identifyStudent', () => {
  it('usa el sub como identificador y manda el correo como propiedad', async () => {
    const { identifyStudent } = await cargarIdentity();

    identifyStudent('u1', 'alumno@utec.edu.pe');

    expect(identify).toHaveBeenCalledWith('u1', { email: 'alumno@utec.edu.pe' });
  });

  // El token puede no traer correo, y eso no debería mandar `{ email: '' }`.
  it('sin correo no inventa la propiedad', async () => {
    const { identifyStudent } = await cargarIdentity();

    identifyStudent('u1', '');

    expect(identify).toHaveBeenCalledWith('u1', undefined);
  });

  // `getClaims()` se vuelve a resolver con cada refresco de token; repetir el
  // identify por eso no aporta nada.
  it('no repite el identify para la misma cuenta', async () => {
    const { identifyStudent } = await cargarIdentity();

    identifyStudent('u1', 'alumno@utec.edu.pe');
    identifyStudent('u1', 'alumno@utec.edu.pe');

    expect(identify).toHaveBeenCalledTimes(1);
  });

  it('sin las variables de entorno no toca PostHog', async () => {
    delete process.env[TOKEN];
    const { identifyStudent } = await cargarIdentity();

    identifyStudent('u1', 'alumno@utec.edu.pe');

    expect(identify).not.toHaveBeenCalled();
  });
});

describe('forgetStudent', () => {
  it('desata la identidad al cerrar sesión', async () => {
    const { forgetStudent } = await cargarIdentity();

    forgetStudent();

    expect(reset).toHaveBeenCalledTimes(1);
  });

  // Sin esto, quien vuelve a entrar con la misma cuenta en el mismo navegador
  // se quedaría sin identificar por el recuerdo del identify anterior.
  it('deja volver a identificar a la misma cuenta después de salir', async () => {
    const { identifyStudent, forgetStudent } = await cargarIdentity();

    identifyStudent('u1', 'alumno@utec.edu.pe');
    forgetStudent();
    identifyStudent('u1', 'alumno@utec.edu.pe');

    expect(identify).toHaveBeenCalledTimes(2);
  });

  it('sin las variables de entorno no toca PostHog', async () => {
    delete process.env[HOST];
    const { forgetStudent } = await cargarIdentity();

    forgetStudent();

    expect(reset).not.toHaveBeenCalled();
  });
});
