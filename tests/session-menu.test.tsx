// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import SessionMenu from '@/components/SessionMenu';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';

vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/config', () => ({ isSupabaseConfigured: vi.fn() }));

const configured = vi.mocked(isSupabaseConfigured);
const clientMock = vi.mocked(createClient);

const unsubscribe = vi.fn();

/** Cliente mínimo: `getClaims` y la suscripción que hay que soltar al salir. */
function fakeClient(claims: Record<string, unknown> | null) {
  return {
    auth: {
      getClaims: () => Promise.resolve({ data: claims ? { claims } : null, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe } } }),
    },
  } as unknown as ReturnType<typeof createClient>;
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  configured.mockReturnValue(true);
});

describe('SessionMenu', () => {
  // T037: sin las variables de entorno la cabecera se ve igual que antes de las
  // reseñas, y no se llega ni a construir el cliente.
  it('sin Supabase no renderiza nada', () => {
    configured.mockReturnValue(false);

    const { container } = render(<SessionMenu />);

    expect(container.textContent).toBe('');
    expect(clientMock).not.toHaveBeenCalled();
  });

  // Mostrar «Iniciar sesión» y cambiarlo medio segundo después le parpadea a
  // quien ya tiene sesión.
  it('mientras resuelve no ofrece iniciar sesión', () => {
    clientMock.mockReturnValue(fakeClient({ sub: 'u1', email: 'alumno@utec.edu.pe' }));

    render(<SessionMenu />);

    expect(screen.queryByText('Iniciar sesión')).toBeNull();
    expect(screen.queryByText('alumno')).toBeNull();
  });

  it('sin sesión ofrece iniciar sesión contra el route handler', async () => {
    clientMock.mockReturnValue(fakeClient(null));

    render(<SessionMenu />);

    const login = await screen.findByRole('link', { name: /Iniciar sesión/ });
    expect(login.getAttribute('href')).toBe('/auth/login');
  });

  it('con sesión muestra la cuenta y lleva al perfil', async () => {
    clientMock.mockReturnValue(fakeClient({ sub: 'u1', email: 'alumno@utec.edu.pe' }));

    render(<SessionMenu />);

    const account = await screen.findByRole('link', { name: 'alumno' });
    expect(account.getAttribute('href')).toBe('/perfil');
    expect(account.getAttribute('title')).toBe('alumno@utec.edu.pe');
    expect(screen.queryByText('Iniciar sesión')).toBeNull();
  });

  // Cerrar sesión tiene que ser POST: un GET lo dispararía un prefetch o un
  // escáner de enlaces.
  it('cerrar sesión va por POST', async () => {
    clientMock.mockReturnValue(fakeClient({ sub: 'u1', email: 'alumno@utec.edu.pe' }));

    render(<SessionMenu />);

    const salir = await screen.findByRole('button', { name: 'Salir' });
    const form = salir.closest('form');
    expect(form?.getAttribute('method')).toBe('post');
    expect(form?.getAttribute('action')).toBe('/auth/signout');
  });

  // Sin esto, cada curso desplegado dejaría una suscripción viva.
  it('suelta la suscripción al desmontarse', async () => {
    clientMock.mockReturnValue(fakeClient({ sub: 'u1', email: 'alumno@utec.edu.pe' }));

    const { unmount } = render(<SessionMenu />);
    await screen.findByRole('link', { name: 'alumno' });

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('un token sin correo no rompe la cabecera', async () => {
    clientMock.mockReturnValue(fakeClient({ sub: 'u1' }));

    render(<SessionMenu />);

    expect(await screen.findByRole('link', { name: 'Mi cuenta' })).toBeDefined();
  });
});
