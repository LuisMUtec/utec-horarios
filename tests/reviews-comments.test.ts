import { describe, it, expect } from 'vitest';
import {
  getCourseTeacherId,
  getOwnReview,
  getPairComments,
  type ReviewsClient,
} from '@/lib/reviews';

type FakeRow = Record<string, unknown>;

interface FakeCalls {
  table: string;
  columns: string;
  filters: Array<[string, unknown]>;
  order: Array<[string, { ascending?: boolean } | undefined]>;
}

/** `from().select().eq().order()` encadenable y esperable, más `maybeSingle`. */
function fakeClient(rows: FakeRow[], error: { message: string } | null = null) {
  const calls: FakeCalls = { table: '', columns: '', filters: [], order: [] };
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
    order(column: string, options?: { ascending?: boolean }) {
      calls.order.push([column, options]);
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

  return { client: client as unknown as ReviewsClient, calls };
}

const commentRow = (overrides: FakeRow = {}): FakeRow => ({
  id: '9a1f2c30-0000-4000-8000-000000000001',
  rating: 4,
  recommends: true,
  comment: 'Explica con calma y responde dudas fuera de clase.',
  comment_published_at: '2026-05-12T15:04:05Z',
  comment_edited_at: null,
  ...overrides,
});

describe('getPairComments — proyección', () => {
  // SC-006 es lo que este test protege: la vista no trae author_id, y la lista
  // de columnas es lo que impide que una columna nueva se cuele sola.
  it('no deja salir nada del autor aunque la fila cruda lo traiga', async () => {
    const authorId = 'c0ffee00-dead-4bee-9f00-0123456789ab';
    const { client, calls } = fakeClient([
      commentRow({ author_id: authorId, author_email: 'alumno@utec.edu.pe', term: 7 }),
    ]);

    const [comment] = await getPairComments(client, 'CS2023', 'bojeda@utec.edu.pe');

    expect(Object.keys(comment).sort()).toEqual([
      'comment',
      'editedAt',
      'id',
      'publishedAt',
      'rating',
      'recommends',
    ]);

    const serialized = JSON.stringify(comment);
    expect(serialized).not.toMatch(/author/i);
    expect(serialized).not.toContain(authorId);
    expect(serialized).not.toMatch(/carrera|career|term|ciclo/i);
    expect(calls.columns).not.toMatch(/author/i);
  });

  it('proyecta puntuación, recomendación, texto, fecha y marca de edición', async () => {
    const { client } = fakeClient([commentRow({ comment_edited_at: '2026-06-01T10:00:00Z' })]);

    expect(await getPairComments(client, 'CS2023', 'bojeda@utec.edu.pe')).toEqual([
      {
        id: '9a1f2c30-0000-4000-8000-000000000001',
        rating: 4,
        recommends: true,
        comment: 'Explica con calma y responde dudas fuera de clase.',
        publishedAt: '2026-05-12T15:04:05Z',
        editedAt: '2026-06-01T10:00:00Z',
      },
    ]);
  });

  // D2 y FR-064: con una puntuación de marzo y un comentario de julio, mostrar
  // published_at desinforma.
  it('la fecha visible es la del comentario, no la de la reseña', async () => {
    const { client, calls } = fakeClient([
      commentRow({
        comment_published_at: '2026-07-20T12:00:00Z',
        published_at: '2026-03-01T12:00:00Z',
      }),
    ]);

    const [comment] = await getPairComments(client, 'CS2023', 'bojeda@utec.edu.pe');

    expect(comment.publishedAt).toBe('2026-07-20T12:00:00Z');
    expect(JSON.stringify(comment)).not.toContain('2026-03-01');
    // Ni siquiera se pide: la vista tampoco la expone.
    expect(calls.columns).not.toMatch(/(^|[^_])published_at/);
  });

  it('sin edición la marca queda en null', async () => {
    const { client } = fakeClient([commentRow()]);
    const [comment] = await getPairComments(client, 'CS2023', 'bojeda@utec.edu.pe');
    expect(comment.editedAt).toBeNull();
  });
});

describe('getPairComments — orden y filtros', () => {
  // FR-034
  it('pide el orden por fecha del comentario, del más reciente al más antiguo', async () => {
    const { client, calls } = fakeClient([]);

    await getPairComments(client, 'CS2023', 'bojeda@utec.edu.pe');

    expect(calls.order).toEqual([['comment_published_at', { ascending: false }]]);
  });

  it('consulta la vista filtrando por el par', async () => {
    const { client, calls } = fakeClient([]);

    await getPairComments(client, 'CS2023', 'bojeda@utec.edu.pe');

    expect(calls.table).toBe('review_comments');
    expect(calls.filters).toEqual([
      ['course_code', 'CS2023'],
      ['teacher_email', 'bojeda@utec.edu.pe'],
    ]);
  });

  it('conserva el orden en que llegan las filas', async () => {
    // El orden lo pone Postgres; la proyección no puede reordenarlo por su
    // cuenta o el `order` de arriba dejaría de significar algo.
    const { client } = fakeClient([
      commentRow({ id: 'a', comment_published_at: '2026-07-01T00:00:00Z' }),
      commentRow({ id: 'b', comment_published_at: '2026-06-01T00:00:00Z' }),
      commentRow({ id: 'c', comment_published_at: '2026-05-01T00:00:00Z' }),
    ]);

    const comments = await getPairComments(client, 'CS2023', 'bojeda@utec.edu.pe');
    expect(comments.map((comment) => comment.id)).toEqual(['a', 'b', 'c']);
  });

  // FR-036, escenario 28: una puntuación sin texto no es un comentario vacío.
  it('una fila sin texto no produce entrada', async () => {
    const { client } = fakeClient([
      commentRow({ id: 'a' }),
      commentRow({ id: 'b', comment: null }),
      commentRow({ id: 'c', comment: null, comment_published_at: null }),
    ]);

    const comments = await getPairComments(client, 'CS2023', 'bojeda@utec.edu.pe');

    expect(comments).toHaveLength(1);
    expect(comments[0].id).toBe('a');
  });

  it('un par sin comentarios devuelve lista vacía', async () => {
    const { client } = fakeClient([]);
    await expect(getPairComments(client, 'CS2023', 'bojeda@utec.edu.pe')).resolves.toEqual([]);
  });

  it('falla en español cuando la consulta falla', async () => {
    const { client } = fakeClient([], { message: 'permission denied' });

    await expect(getPairComments(client, 'CS2023', 'bojeda@utec.edu.pe')).rejects.toThrow(
      /No se pudieron cargar los comentarios/
    );
  });
});

describe('getCourseTeacherId', () => {
  it('devuelve el id del par', async () => {
    const { client, calls } = fakeClient([{ id: 'par-1' }]);

    await expect(getCourseTeacherId(client, 'CS2023', 'bojeda@utec.edu.pe')).resolves.toBe(
      'par-1'
    );
    expect(calls.table).toBe('course_teachers');
    expect(calls.filters).toEqual([
      ['course_code', 'CS2023'],
      ['teacher_email', 'bojeda@utec.edu.pe'],
    ]);
  });

  // R6: la política de course_teachers solo deja ver `is_current`, así que un
  // par apagado llega como inexistente y el handler responde 404.
  it('devuelve null cuando el par no está', async () => {
    const { client } = fakeClient([]);
    await expect(getCourseTeacherId(client, 'CS2023', 'nadie@utec.edu.pe')).resolves.toBeNull();
  });

  it('no filtra por is_current desde la aplicación', async () => {
    const { client, calls } = fakeClient([{ id: 'par-1' }]);

    await getCourseTeacherId(client, 'CS2023', 'bojeda@utec.edu.pe');

    expect(calls.filters.map(([column]) => column)).not.toContain('is_current');
  });
});

describe('getOwnReview', () => {
  const ownRow = (overrides: FakeRow = {}): FakeRow => ({
    id: 'r-1',
    rating: 5,
    recommends: true,
    comment: null,
    published_at: '2026-03-01T12:00:00Z',
    comment_published_at: null,
    comment_edited_at: null,
    ...overrides,
  });

  it('devuelve la reseña propia del par', async () => {
    const { client, calls } = fakeClient([ownRow()]);

    await expect(getOwnReview(client, 'par-1')).resolves.toEqual({
      id: 'r-1',
      rating: 5,
      recommends: true,
      comment: null,
      publishedAt: '2026-03-01T12:00:00Z',
      commentPublishedAt: null,
      commentEditedAt: null,
    });
    expect(calls.table).toBe('reviews');
    expect(calls.filters).toEqual([['course_teacher_id', 'par-1']]);
  });

  // La política de `reviews` ya limita a la fila propia y activa: repetirlo acá
  // sugeriría que es la aplicación la que protege el dato.
  it('no filtra por autor desde la aplicación', async () => {
    const { client, calls } = fakeClient([ownRow()]);

    await getOwnReview(client, 'par-1');

    expect(calls.filters.map(([column]) => column)).not.toContain('author_id');
  });

  it('devuelve null cuando el estudiante no reseñó ese par', async () => {
    const { client } = fakeClient([]);
    await expect(getOwnReview(client, 'par-1')).resolves.toBeNull();
  });

  it('falla en español cuando la consulta falla', async () => {
    const { client } = fakeClient([], { message: 'boom' });
    await expect(getOwnReview(client, 'par-1')).rejects.toThrow(/No se pudo cargar tu reseña/);
  });
});
