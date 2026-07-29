import { describe, it, expect } from 'vitest';
import { createReview, parseReleaseAt, type ReviewsClient } from '@/lib/reviews';
import { DUPLICATE_REVIEW_MESSAGE } from '@/lib/review-submit';

type FakeRow = Record<string, unknown>;
type FakeError = { code?: string; message: string };

interface FakeCalls {
  table: string;
  columns: string;
  values: FakeRow | null;
}

/** `from().insert().select().single()`, encadenable y esperable. */
function fakeClient(row: FakeRow | null, error: FakeError | null = null) {
  const calls: FakeCalls = { table: '', columns: '', values: null };

  const builder = {
    insert(values: FakeRow) {
      calls.values = values;
      return builder;
    },
    select(columns: string) {
      calls.columns = columns;
      return builder;
    },
    single() {
      return Promise.resolve({ data: error ? null : row, error });
    },
  };

  const client = {
    from(table: string) {
      calls.table = table;
      return builder;
    },
  };

  return { client: client as unknown as ReviewsClient, calls };
}

const insertedRow = (overrides: FakeRow = {}): FakeRow => ({
  id: '9a1f2c30-0000-4000-8000-000000000001',
  rating: 4,
  recommends: true,
  comment: null,
  published_at: '2026-07-29T15:04:05Z',
  comment_published_at: null,
  comment_edited_at: null,
  ...overrides,
});

const AUTHOR = 'c0ffee00-dead-4bee-9f00-0123456789ab';
const PAIR = '5e4b0f4a-0d1e-4a3f-9c2b-7a1c8d6e5f40';

const publish = (client: ReviewsClient) =>
  createReview(client, AUTHOR, PAIR, { rating: 4, recommends: true });

describe('createReview — inserción', () => {
  it('escribe solo las columnas que el grant concede', async () => {
    const { client, calls } = fakeClient(insertedRow());

    await publish(client);

    expect(calls.table).toBe('reviews');
    expect(Object.keys(calls.values ?? {}).sort()).toEqual([
      'author_id',
      'course_teacher_id',
      'declared_attendance',
      'rating',
      'recommends',
    ]);
  });

  // FR-021: la columna lleva un check que solo acepta `true`; mandarlo desde acá
  // y no desde el cuerpo del pedido es lo que impide publicar sin declarar.
  it('fija declared_attendance en true', async () => {
    const { client, calls } = fakeClient(insertedRow());

    await publish(client);

    expect(calls.values?.declared_attendance).toBe(true);
  });

  it('no escribe fechas ni estado: los sellan los triggers', async () => {
    const { client, calls } = fakeClient(insertedRow());

    await publish(client);

    const written = Object.keys(calls.values ?? {});
    expect(written).not.toContain('published_at');
    expect(written).not.toContain('state');
    expect(written).not.toContain('purge_after');
  });

  it('devuelve la reseña ya proyectada', async () => {
    const { client } = fakeClient(insertedRow());

    const result = await publish(client);

    expect(result).toEqual({
      ok: true,
      review: {
        id: '9a1f2c30-0000-4000-8000-000000000001',
        rating: 4,
        recommends: true,
        comment: null,
        publishedAt: '2026-07-29T15:04:05Z',
        commentPublishedAt: null,
        commentEditedAt: null,
      },
    });
  });
});

describe('createReview — rechazos de la base', () => {
  // FR-027, escenario 16.
  it('traduce la unicidad del par a `duplicate`', async () => {
    const { client } = fakeClient(null, {
      code: '23505',
      message: 'duplicate key value violates unique constraint "reviews_one_active_per_pair"',
    });

    const result = await publish(client);

    expect(result).toEqual({
      ok: false,
      rejection: { code: 'duplicate', message: DUPLICATE_REVIEW_MESSAGE },
    });
  });

  // FR-030 y FR-031: el instante sale del trigger porque cuenta también las
  // reseñas eliminadas, que el autor ya no puede leer.
  it('traduce el límite de 24 horas y rescata el instante de liberación', async () => {
    const { client } = fakeClient(null, {
      code: '23514',
      message:
        'Alcanzaste el límite de 8 puntuaciones en 24 horas. ' +
        'Podrás publicar de nuevo a partir de 2026-07-30T15:45:00+00.',
    });

    const result = await publish(client);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.rejection.code).toBe('rate_limit');
    expect(result.ok === false && result.rejection.code === 'rate_limit' && result.rejection.releaseAt).toBe(
      '2026-07-30T15:45:00.000Z'
    );
  });

  // FR-028: el par salió de la oferta entre que se pintó la UI y se publicó.
  it('traduce el par fuera de la oferta a `not_current`', async () => {
    const { client } = fakeClient(null, {
      code: '23514',
      message: 'Ese docente ya no dicta este curso en la oferta vigente.',
    });

    const result = await publish(client);

    expect(result).toEqual({
      ok: false,
      rejection: {
        code: 'not_current',
        message: 'Ese docente ya no dicta este curso en la oferta vigente.',
      },
    });
  });

  // Un rechazo que no sabemos leer no puede volverse un «publicado»: se lanza.
  it.each([
    ['un check que no reconoce', { code: '23514', message: 'algo nuevo salió mal' }],
    ['un rechazo de RLS', { code: '42501', message: 'new row violates row-level security policy' }],
    ['un error sin código', { message: 'la conexión se cayó' }],
  ])('lanza ante %s', async (_, error) => {
    const { client } = fakeClient(null, error);

    await expect(publish(client)).rejects.toThrow('No se pudo publicar la reseña');
  });
});

describe('parseReleaseAt', () => {
  it.each([
    ['sin minutos de desfase', '2026-07-30T15:45:00+00', '2026-07-30T15:45:00.000Z'],
    ['con desfase de Lima', '2026-07-30T10:45:00-05', '2026-07-30T15:45:00.000Z'],
    ['con minutos explícitos', '2026-07-30T15:45:00+00:00', '2026-07-30T15:45:00.000Z'],
    ['con minutos pegados', '2026-07-30T10:45:00-0500', '2026-07-30T15:45:00.000Z'],
  ])('%s', (_, instant, expected) => {
    expect(parseReleaseAt(`Podrás publicar de nuevo a partir de ${instant}.`)).toBe(expected);
  });

  it.each([
    ['un mensaje sin fecha', 'Alcanzaste el límite de 8 puntuaciones en 24 horas.'],
    ['una fecha sin hora', 'a partir de 2026-07-30.'],
    ['una fecha imposible', 'a partir de 2026-13-45T99:99:99+00.'],
  ])('devuelve null ante %s', (_, message) => {
    expect(parseReleaseAt(message)).toBeNull();
  });
});
