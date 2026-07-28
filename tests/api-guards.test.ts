import { describe, it, expect } from 'vitest';
import {
  ANONYMOUS_MESSAGE,
  BANNED_MESSAGE,
  requireStudent,
  resolveStudent,
  type GuardClient,
} from '@/lib/api-guards';

const USER_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

interface FakeOptions {
  claims?: Record<string, unknown> | null;
  authError?: { message: string } | null;
  profile?: Record<string, unknown> | null;
  profileError?: { message: string } | null;
}

function fakeClient({
  claims = null,
  authError = null,
  profile = null,
  profileError = null,
}: FakeOptions) {
  const calls = { columns: '', filters: [] as Array<[string, unknown]> };

  const builder = {
    select(columns: string) {
      calls.columns = columns;
      return builder;
    },
    eq(column: string, value: unknown) {
      calls.filters.push([column, value]);
      return builder;
    },
    single() {
      return Promise.resolve({ data: profileError ? null : profile, error: profileError });
    },
  };

  const client = {
    auth: {
      getClaims: async () => ({
        data: authError || !claims ? null : { claims },
        error: authError,
      }),
      // FR-013 se apoya en que la firma del token esté verificada: la cookie la
      // escribe el navegador. Si algún día alguien cambia el guard a
      // `getSession()`, este throw lo convierte en un test rojo y no en un
      // agujero silencioso.
      getSession: () => {
        throw new Error('getSession no verifica la firma del token');
      },
    },
    from: () => builder,
  };

  return { client: client as unknown as GuardClient, calls };
}

const activeProfile = (overrides: Record<string, unknown> = {}) => ({
  banned_at: null,
  ban_reason: null,
  term: 5,
  careers: { slug: 'fisica', name: 'Física' },
  ...overrides,
});

describe('resolveStudent', () => {
  it('sin sesión es anónimo y no consulta el perfil', async () => {
    const { client, calls } = fakeClient({ claims: null });

    expect(await resolveStudent(client)).toEqual({ kind: 'anonymous' });
    expect(calls.filters).toEqual([]);
  });

  it('un token sin sub es anónimo', async () => {
    const { client } = fakeClient({ claims: { email: 'alumno@utec.edu.pe' } });
    expect(await resolveStudent(client)).toEqual({ kind: 'anonymous' });
  });

  it('un error al leer las claims es anónimo, no un fallo', async () => {
    const { client } = fakeClient({ authError: { message: 'jwt expired' } });
    expect(await resolveStudent(client)).toEqual({ kind: 'anonymous' });
  });

  it('devuelve carrera y ciclo del perfil, buscando por el sub del token', async () => {
    const { client, calls } = fakeClient({
      claims: { sub: USER_ID, email: 'alumno@utec.edu.pe' },
      profile: activeProfile(),
    });

    expect(await resolveStudent(client)).toEqual({
      kind: 'student',
      student: {
        userId: USER_ID,
        careerSlug: 'fisica',
        careerName: 'Física',
        term: 5,
      },
    });
    expect(calls.filters).toEqual([['id', USER_ID]]);
  });

  // PostgREST devuelve un objeto para la relación a-uno, pero los tipos
  // generados la declaran isOneToOne: false y hay versiones que la dan como
  // arreglo.
  it('acepta la carrera embebida como arreglo', async () => {
    const { client } = fakeClient({
      claims: { sub: USER_ID },
      profile: activeProfile({ careers: [{ slug: 'fisica', name: 'Física' }] }),
    });

    const access = await resolveStudent(client);
    expect(access.kind === 'student' && access.student.careerSlug).toBe('fisica');
  });

  it('un perfil sin carrera ni ciclo sigue siendo un estudiante (FR-016)', async () => {
    const { client } = fakeClient({
      claims: { sub: USER_ID },
      profile: activeProfile({ term: null, careers: null }),
    });

    expect(await resolveStudent(client)).toEqual({
      kind: 'student',
      student: { userId: USER_ID, careerSlug: null, careerName: null, term: null },
    });
  });

  it('un arreglo vacío de carrera se lee como sin carrera', async () => {
    const { client } = fakeClient({
      claims: { sub: USER_ID },
      profile: activeProfile({ careers: [] }),
    });

    const access = await resolveStudent(client);
    expect(access.kind === 'student' && access.student.careerSlug).toBeNull();
  });

  it('devuelve la sanción con su motivo', async () => {
    const { client } = fakeClient({
      claims: { sub: USER_ID },
      profile: activeProfile({
        banned_at: '2026-07-01T00:00:00Z',
        ban_reason: 'Insultos hacia un docente.',
      }),
    });

    expect(await resolveStudent(client)).toEqual({
      kind: 'banned',
      userId: USER_ID,
      reason: 'Insultos hacia un docente.',
    });
  });

  // Sin fila hay una inconsistencia real: dejar pasar a alguien sin perfil haría
  // que los updates no afectaran nada en silencio.
  it('falla cuando el perfil no se puede leer', async () => {
    const { client } = fakeClient({
      claims: { sub: USER_ID },
      profileError: { message: 'no rows returned' },
    });

    await expect(resolveStudent(client)).rejects.toThrow(/No se pudo leer el perfil/);
  });

  it('no pide columnas que no necesita', async () => {
    const { client, calls } = fakeClient({
      claims: { sub: USER_ID },
      profile: activeProfile(),
    });

    await resolveStudent(client);

    expect(calls.columns).toContain('banned_at');
    expect(calls.columns).toContain('ban_reason');
    expect(calls.columns).not.toMatch(/created_at|deactivated_at/);
  });
});

describe('requireStudent', () => {
  it('sin sesión responde 401 en español', async () => {
    const { client } = fakeClient({ claims: null });
    const guard = await requireStudent(client);

    expect(guard.ok).toBe(false);
    if (guard.ok) return;

    expect(guard.response.status).toBe(401);
    await expect(guard.response.json()).resolves.toEqual({ error: ANONYMOUS_MESSAGE });
  });

  it('con sesión y sin sanción deja pasar con el estudiante', async () => {
    const { client } = fakeClient({
      claims: { sub: USER_ID },
      profile: activeProfile(),
    });
    const guard = await requireStudent(client);

    expect(guard.ok).toBe(true);
    expect(guard.ok && guard.student.userId).toBe(USER_ID);
  });

  // FR-057: un rechazo de RLS es un fallo genérico y no alcanza. El motivo tiene
  // que llegar al cuerpo para que la interfaz pueda mostrarlo.
  it('con sanción responde 403 con el motivo en el cuerpo', async () => {
    const { client } = fakeClient({
      claims: { sub: USER_ID },
      profile: activeProfile({
        banned_at: '2026-07-01T00:00:00Z',
        ban_reason: 'Datos personales de un tercero.',
      }),
    });
    const guard = await requireStudent(client);

    expect(guard.ok).toBe(false);
    if (guard.ok) return;

    expect(guard.response.status).toBe(403);
    await expect(guard.response.json()).resolves.toEqual({
      error: BANNED_MESSAGE,
      banned: true,
      reason: 'Datos personales de un tercero.',
    });
  });

  it('el mensaje de la sanción dice que es permanente', async () => {
    expect(BANNED_MESSAGE).toMatch(/permanente/i);
  });
});
