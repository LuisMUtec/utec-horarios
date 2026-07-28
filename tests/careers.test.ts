import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  getActiveCareers,
  getCareerIdBySlug,
  groupByFaculty,
  outdatedOption,
  type CareersClient,
  type Career,
} from '@/lib/careers';

// El catálogo tiene dos frentes que se pueden separar sin que nada falle: la
// migración que lo inserta y el documento que dice cuál es la lista oficial.
// Este archivo los enfrenta.

const SPEC_DIR = join(process.cwd(), 'specs', '002-resenas-docentes');
const MIGRATION = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '20260729090100_catalogo_de_carreras.sql'),
  'utf8'
);
const DOCUMENT = readFileSync(join(SPEC_DIR, 'carreras-utec.md'), 'utf8');

/** Las filas del `insert`: `('slug', 'Nombre', 'Facultad'),`. */
function careersInMigration(): Career[] {
  return [...MIGRATION.matchAll(/^\s*\('([^']+)',\s*'([^']+)',\s*'([^']+)'\)/gm)].map(
    ([, slug, name, faculty]) => ({ slug, name, faculty })
  );
}

/**
 * Las filas de la tabla markdown: `| Facultad | Carrera | \`slug\` |`.
 *
 * El cuerpo empieza después del separador `|---|---|---|`: el encabezado tiene
 * la misma forma —su tercera celda también va entre backticks— y sin cortar ahí
 * entraría como una carrera llamada «Carrera».
 */
function careersInDocument(): Career[] {
  const body = DOCUMENT.split(/^\|[-|]+\|$/m)[1] ?? '';

  return [...body.matchAll(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*`([^`]+)`\s*\|/gm)].map(
    ([, faculty, name, slug]) => ({ slug, name, faculty })
  );
}

const bySlug = (a: Career, b: Career) => a.slug.localeCompare(b.slug);

describe('el catálogo de carreras y su documento no se separan', () => {
  const migration = careersInMigration();
  const document = careersInDocument();

  it('la migración inserta 16 carreras', () => {
    expect(migration).toHaveLength(16);
  });

  it('el documento lista las mismas 16', () => {
    expect(document).toHaveLength(16);
  });

  // El documento dice el número en prosa: sumar una fila y olvidar la frase deja
  // el propio documento contradiciéndose.
  it('la cuenta escrita en el documento coincide con sus filas', () => {
    const declared = DOCUMENT.match(/^Son (\d+)\.$/m)?.[1];
    expect(Number(declared)).toBe(document.length);
  });

  it('cada slug cumple el check de la tabla', () => {
    // Mismo patrón que `careers.slug ~ '^[a-z0-9-]+$'`: un slug que no lo cumpla
    // hace fallar la migración recién al aplicarla.
    for (const career of migration) {
      expect(career.slug, career.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('no hay slugs repetidos', () => {
    expect(new Set(migration.map((career) => career.slug)).size).toBe(migration.length);
  });

  it('slug, nombre y facultad coinciden uno a uno', () => {
    expect([...migration].sort(bySlug)).toEqual([...document].sort(bySlug));
  });

  it('el upsert va por slug, que es la llave que no se cambia', () => {
    // Sin `on conflict (slug)` una segunda aplicación duplicaría el catálogo.
    expect(MIGRATION).toMatch(/on conflict \(slug\) do update/);
  });
});

describe('groupByFaculty', () => {
  const catalog = careersInMigration();

  it('agrupa las 16 en sus cuatro facultades', () => {
    const groups = groupByFaculty(catalog);

    expect(groups.map((group) => group.faculty)).toEqual([
      'Ciencias Básicas',
      'Computación',
      'Ingeniería',
      'Negocios',
    ]);
    expect(groups.flatMap((group) => group.careers)).toHaveLength(16);
  });

  it('ordena las carreras por nombre dentro de cada facultad', () => {
    const [computacion] = groupByFaculty(catalog).filter(
      (group) => group.faculty === 'Computación'
    );

    expect(computacion.careers.map((career) => career.name)).toEqual([
      'Ciberseguridad',
      'Ciencia de Datos e Inteligencia Artificial',
      'Ciencia de la Computación',
      'Sistemas de Información',
    ]);
  });

  it('ordena las facultades sin depender del orden de entrada', () => {
    const reversed = groupByFaculty([...catalog].reverse());
    expect(reversed.map((group) => group.faculty)).toEqual(
      groupByFaculty(catalog).map((group) => group.faculty)
    );
  });

  it('con el catálogo vacío devuelve una lista vacía, no un grupo vacío', () => {
    expect(groupByFaculty([])).toEqual([]);
  });

  it('no muta el arreglo que recibe', () => {
    const input = [...catalog];
    groupByFaculty(input);
    expect(input).toEqual(catalog);
  });
});

describe('outdatedOption', () => {
  const catalog: Career[] = [
    { slug: 'fisica', name: 'Física', faculty: 'Ciencias Básicas' },
  ];

  it('devuelve null cuando la carrera sigue vigente', () => {
    expect(outdatedOption(catalog, { careerSlug: 'fisica', careerName: 'Física' })).toBeNull();
  });

  it('devuelve null cuando el perfil no tiene carrera', () => {
    expect(outdatedOption(catalog, { careerSlug: null, careerName: null })).toBeNull();
  });

  // Sin esto el selector la borraría de la vista y el primer guardado la
  // perdería sin que el estudiante lo pidiera.
  it('conserva la carrera que salió del catálogo', () => {
    expect(
      outdatedOption(catalog, { careerSlug: 'quimica', careerName: 'Ingeniería Química' })
    ).toEqual({ slug: 'quimica', name: 'Ingeniería Química' });
  });

  it('cae al slug cuando tampoco se conoce el nombre', () => {
    expect(outdatedOption(catalog, { careerSlug: 'quimica', careerName: null })).toEqual({
      slug: 'quimica',
      name: 'quimica',
    });
  });
});

type FakeRow = Record<string, unknown>;

/** Cliente mínimo: `from().select().eq()` encadenable, esperable y con `maybeSingle`. */
function fakeClient(rows: FakeRow[], error: { message: string } | null = null) {
  const calls = { table: '', columns: '', filters: [] as Array<[string, unknown]> };
  const result = { data: error ? null : rows, error };

  const builder = {
    select(columns: string) {
      calls.columns = columns;
      return builder;
    },
    eq(column: string, value: unknown) {
      calls.filters.push([column, value]);
      return builder;
    },
    maybeSingle() {
      return Promise.resolve({ data: error ? null : (rows[0] ?? null), error });
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

  return { client: client as unknown as CareersClient, calls };
}

describe('getActiveCareers', () => {
  it('consulta solo las vigentes y sin traer el id', async () => {
    const { client, calls } = fakeClient([
      { slug: 'fisica', name: 'Física', faculty: 'Ciencias Básicas' },
    ]);

    await getActiveCareers(client);

    expect(calls.table).toBe('careers');
    expect(calls.filters).toEqual([['is_active', true]]);
    expect(calls.columns).not.toMatch(/\bid\b/);
  });

  it('proyecta solo slug, nombre y facultad aunque la fila traiga más', async () => {
    const { client } = fakeClient([
      {
        id: '00000000-0000-4000-8000-000000000001',
        slug: 'fisica',
        name: 'Física',
        faculty: 'Ciencias Básicas',
        is_active: true,
      },
    ]);

    expect(await getActiveCareers(client)).toEqual([
      { slug: 'fisica', name: 'Física', faculty: 'Ciencias Básicas' },
    ]);
  });

  it('falla en español cuando la consulta falla', async () => {
    const { client } = fakeClient([], { message: 'permission denied' });

    await expect(getActiveCareers(client)).rejects.toThrow(
      /No se pudo cargar el catálogo de carreras/
    );
  });
});

describe('getCareerIdBySlug', () => {
  it('devuelve el id de la carrera', async () => {
    const { client, calls } = fakeClient([{ id: 'c0ffee00-0000-4000-8000-000000000001' }]);

    await expect(getCareerIdBySlug(client, 'fisica')).resolves.toBe(
      'c0ffee00-0000-4000-8000-000000000001'
    );
    expect(calls.filters).toEqual([['slug', 'fisica']]);
  });

  // Sin filtrar is_active: quien ya tenía una carrera dada de baja tiene que
  // poder volver a guardarla, o no podría actualizar su ciclo nunca más.
  it('no filtra por is_active', async () => {
    const { client, calls } = fakeClient([{ id: 'x' }]);

    await getCareerIdBySlug(client, 'fisica');

    expect(calls.filters.map(([column]) => column)).not.toContain('is_active');
  });

  it('devuelve null cuando el slug no existe', async () => {
    const { client } = fakeClient([]);
    await expect(getCareerIdBySlug(client, 'inventada')).resolves.toBeNull();
  });

  it('falla en español cuando la consulta falla', async () => {
    const { client } = fakeClient([], { message: 'boom' });

    await expect(getCareerIdBySlug(client, 'fisica')).rejects.toThrow(
      /No se pudo resolver la carrera fisica/
    );
  });
});
