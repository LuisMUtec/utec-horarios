import { describe, it, expect } from 'vitest';
import {
  TERM_MAX,
  TERM_MIN,
  isProfileComplete,
  profileDiff,
  profileDraft,
  saveProfile,
  validateProfileUpdate,
  type Profile,
  type ProfileClient,
} from '@/lib/profile';

const SLUGS = ['ciencia-de-la-computacion', 'fisica'];

const profile = (partial: Partial<Profile> = {}): Profile => ({
  careerSlug: null,
  careerName: null,
  term: null,
  ...partial,
});

describe('validateProfileUpdate — ciclo', () => {
  it.each([1, 5, 10])('acepta el ciclo %i', (term) => {
    expect(validateProfileUpdate({ term }, SLUGS)).toEqual({ ok: true, value: { term } });
  });

  it.each([0, 11, -3, 100])('rechaza el ciclo %i', (term) => {
    const result = validateProfileUpdate({ term }, SLUGS);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors.term).toBe(
      `El ciclo va del ${TERM_MIN} al ${TERM_MAX}.`
    );
  });

  it.each([[5.5], [Number.NaN], [Number.POSITIVE_INFINITY], [true], [{}], [[5]]])(
    'rechaza %s porque no es un entero',
    (term) => {
      const result = validateProfileUpdate({ term }, SLUGS);

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.errors.term).toBe(
        'El ciclo debe ser un número entero.'
      );
    }
  );

  // Un `<select>` manda texto; aceptarlo evita un 400 por una diferencia de tipo
  // que no es culpa de quien llena el formulario.
  it('acepta el ciclo como texto de dígitos', () => {
    expect(validateProfileUpdate({ term: '7' }, SLUGS)).toEqual({ ok: true, value: { term: 7 } });
  });

  it.each(['5.5', ' 5', '5 ', 'siete', '0x5'])('rechaza el texto %o', (term) => {
    expect(validateProfileUpdate({ term }, SLUGS).ok).toBe(false);
  });

  it('la cadena vacía del selector limpia el ciclo', () => {
    expect(validateProfileUpdate({ term: '' }, SLUGS)).toEqual({ ok: true, value: { term: null } });
  });

  it('null limpia el ciclo', () => {
    expect(validateProfileUpdate({ term: null }, SLUGS)).toEqual({
      ok: true,
      value: { term: null },
    });
  });
});

describe('validateProfileUpdate — carrera', () => {
  it('acepta un slug del catálogo', () => {
    expect(validateProfileUpdate({ careerSlug: 'fisica' }, SLUGS)).toEqual({
      ok: true,
      value: { careerSlug: 'fisica' },
    });
  });

  it.each(['no-existe', 'FISICA', '', ' fisica'])(
    'rechaza el slug %o que no está en el catálogo',
    (careerSlug) => {
      const result = validateProfileUpdate({ careerSlug }, SLUGS);
      // La cadena vacía es el caso aparte: limpia en vez de fallar.
      if (careerSlug === '') {
        expect(result).toEqual({ ok: true, value: { careerSlug: null } });
        return;
      }
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.errors.careerSlug).toBe(
        'Elige una carrera de la lista.'
      );
    }
  );

  it.each([[42], [true], [{ slug: 'fisica' }], [['fisica']]])(
    'rechaza %s porque no es un slug',
    (careerSlug) => {
      expect(validateProfileUpdate({ careerSlug }, SLUGS).ok).toBe(false);
    }
  );

  it('null limpia la carrera', () => {
    expect(validateProfileUpdate({ careerSlug: null }, SLUGS)).toEqual({
      ok: true,
      value: { careerSlug: null },
    });
  });

  it('el catálogo vacío no deja elegir nada', () => {
    expect(validateProfileUpdate({ careerSlug: 'fisica' }, []).ok).toBe(false);
  });
});

describe('validateProfileUpdate — cuerpo', () => {
  it.each([[null], ['{}'], [42], [[]], [undefined]])('rechaza el cuerpo %s', (body) => {
    const result = validateProfileUpdate(body, SLUGS);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors.form).toBe('El cuerpo del pedido no es válido.');
  });

  it('rechaza un objeto sin ninguno de los dos campos', () => {
    const result = validateProfileUpdate({ nombre: 'Luis' }, SLUGS);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors.form).toBe('No hay nada que actualizar.');
  });

  it('ignora los campos que no son suyos', () => {
    // `banned_at` y `created_at` no son escribibles ni por grant ni por acá.
    expect(validateProfileUpdate({ term: 3, banned_at: null, id: 'otro' }, SLUGS)).toEqual({
      ok: true,
      value: { term: 3 },
    });
  });

  it('acepta los dos campos juntos', () => {
    expect(validateProfileUpdate({ careerSlug: 'fisica', term: 4 }, SLUGS)).toEqual({
      ok: true,
      value: { careerSlug: 'fisica', term: 4 },
    });
  });

  it('un campo inválido invalida el pedido entero', () => {
    const result = validateProfileUpdate({ careerSlug: 'fisica', term: 99 }, SLUGS);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors).toEqual({
      term: `El ciclo va del ${TERM_MIN} al ${TERM_MAX}.`,
    });
  });

  it('acumula los errores de los dos campos', () => {
    const result = validateProfileUpdate({ careerSlug: 'no-existe', term: 99 }, SLUGS);

    expect(result.ok === false && Object.keys(result.errors).sort()).toEqual([
      'careerSlug',
      'term',
    ]);
  });
});

describe('isProfileComplete', () => {
  // FR-016: leer no exige nada. FR-017: escribir un comentario, las dos cosas.
  it('exige carrera y ciclo', () => {
    expect(isProfileComplete(profile({ careerSlug: 'fisica', term: 3 }))).toBe(true);
    expect(isProfileComplete(profile({ careerSlug: 'fisica' }))).toBe(false);
    expect(isProfileComplete(profile({ term: 3 }))).toBe(false);
    expect(isProfileComplete(profile())).toBe(false);
  });
});

describe('profileDraft', () => {
  it('convierte el perfil a lo que muestran los dos selectores', () => {
    expect(profileDraft(profile({ careerSlug: 'fisica', term: 3 }))).toEqual({
      careerSlug: 'fisica',
      term: '3',
    });
  });

  it('lo vacío se ve como la opción sin especificar', () => {
    expect(profileDraft(profile())).toEqual({ careerSlug: '', term: '' });
  });
});

describe('profileDiff', () => {
  const saved = profile({ careerSlug: 'fisica', careerName: 'Física', term: 3 });

  it('sin cambios no manda nada', () => {
    expect(profileDiff(saved, { careerSlug: 'fisica', term: '3' })).toEqual({});
  });

  // Mandar siempre los dos campos haría que corregir el ciclo reescribiera la
  // carrera contra un catálogo que pudo darla de baja con la página abierta.
  it('cambiar el ciclo no manda la carrera', () => {
    expect(profileDiff(saved, { careerSlug: 'fisica', term: '4' })).toEqual({ term: 4 });
  });

  it('cambiar la carrera no manda el ciclo', () => {
    expect(profileDiff(saved, { careerSlug: 'ciencia-de-la-computacion', term: '3' })).toEqual({
      careerSlug: 'ciencia-de-la-computacion',
    });
  });

  it('vaciar un selector se manda como null', () => {
    expect(profileDiff(saved, { careerSlug: '', term: '' })).toEqual({
      careerSlug: null,
      term: null,
    });
  });

  it('sobre un perfil vacío manda solo lo que se llenó', () => {
    expect(profileDiff(profile(), { careerSlug: 'fisica', term: '' })).toEqual({
      careerSlug: 'fisica',
    });
  });

  it('el diff vacío lo rechaza la validación con un mensaje', () => {
    const result = validateProfileUpdate(profileDiff(saved, profileDraft(saved)), SLUGS);
    expect(result.ok === false && result.errors.form).toBe('No hay nada que actualizar.');
  });
});

/** Cliente mínimo: `update().eq().select()`. */
function fakeClient(rows: Array<{ id: string }>, error: { message: string } | null = null) {
  const calls = { table: '', write: null as unknown, filters: [] as Array<[string, unknown]> };
  const result = { data: error ? null : rows, error };

  const builder = {
    update(write: unknown) {
      calls.write = write;
      return builder;
    },
    eq(column: string, value: unknown) {
      calls.filters.push([column, value]);
      return builder;
    },
    select() {
      return builder;
    },
    then(resolve: (value: typeof result) => unknown) {
      return Promise.resolve(result).then(resolve);
    },
  };

  const client = {
    from(table: string) {
      calls.table = table;
      return builder;
    },
  };

  return { client: client as unknown as ProfileClient, calls };
}

describe('saveProfile', () => {
  it('escribe solo las columnas recibidas, sobre la fila del usuario', async () => {
    const { client, calls } = fakeClient([{ id: 'u1' }]);

    await saveProfile(client, 'u1', { term: 5 });

    expect(calls.table).toBe('profiles');
    expect(calls.write).toEqual({ term: 5 });
    expect(calls.filters).toEqual([['id', 'u1']]);
  });

  it('falla en español cuando la consulta falla', async () => {
    const { client } = fakeClient([], { message: 'permission denied' });

    await expect(saveProfile(client, 'u1', { term: 5 })).rejects.toThrow(
      /No se pudo guardar el perfil/
    );
  });

  // Un update que RLS filtra no devuelve error: devuelve cero filas, y sin esto
  // el handler respondería «guardado».
  it('falla cuando el update no alcanzó ninguna fila', async () => {
    const { client } = fakeClient([]);

    await expect(saveProfile(client, 'u1', { term: 5 })).rejects.toThrow(
      /la fila no era alcanzable/
    );
  });
});
