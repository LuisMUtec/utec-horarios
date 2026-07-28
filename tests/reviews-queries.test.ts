import { describe, it, expect } from 'vitest';
import { getCourseSummaries, type ReviewsClient } from '@/lib/reviews';

type FakeRow = Record<string, unknown>;

interface FakeCalls {
  table: string | null;
  columns: string | null;
  filters: Array<[string, unknown]>;
}

/** Cliente mínimo: `from().select().eq()` encadenables y esperables. */
function fakeClient(rows: FakeRow[], error: { message: string } | null = null) {
  const calls: FakeCalls = { table: null, columns: null, filters: [] };
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

const row = (overrides: FakeRow = {}): FakeRow => ({
  course_teacher_id: '5e4b0f4a-0d1e-4a3f-9c2b-7a1c8d6e5f40',
  course_code: 'CS2023',
  teacher_email: 'bojeda@utec.edu.pe',
  teacher_name: 'Ojeda Rios, Brenner Humberto',
  average_rating: 4.3,
  rating_count: 12,
  comment_count: 5,
  recommend_percentage: 83,
  ...overrides,
});

describe('getCourseSummaries', () => {
  it('no deja salir author_id aunque la fila cruda lo traiga', async () => {
    const authorId = 'c0ffee00-dead-4bee-9f00-0123456789ab';
    const { client, calls } = fakeClient([
      row({ author_id: authorId, author_email: 'alumno@utec.edu.pe' }),
    ]);

    const [summary] = await getCourseSummaries(client, 'CS2023');

    expect(Object.keys(summary).sort()).toEqual([
      'averageRating',
      'commentCount',
      'courseCode',
      'courseTeacherId',
      'ratingCount',
      'recommendPercentage',
      'teacherEmail',
      'teacherName',
    ]);
    // Ni la clave ni el valor, en ninguna forma: serializado es como llegaría al
    // navegador.
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toMatch(/author/i);
    expect(serialized).not.toContain(authorId);
    // Y tampoco se pide la columna.
    expect(calls.columns).not.toMatch(/author/i);
  });

  it('devuelve los agregados como number aunque el driver los dé como string', async () => {
    const { client } = fakeClient([
      row({
        average_rating: '4.3',
        rating_count: '12',
        comment_count: '5',
        recommend_percentage: '83',
      }),
    ]);

    const [summary] = await getCourseSummaries(client, 'CS2023');

    expect(summary.averageRating).toBe(4.3);
    expect(summary.ratingCount).toBe(12);
    expect(summary.commentCount).toBe(5);
    expect(summary.recommendPercentage).toBe(83);
    for (const value of [
      summary.averageRating,
      summary.ratingCount,
      summary.commentCount,
      summary.recommendPercentage,
    ]) {
      expect(typeof value).toBe('number');
    }
  });

  it('proyecta el resto de campos a los nombres de la aplicación', async () => {
    const { client } = fakeClient([row()]);

    expect(await getCourseSummaries(client, 'CS2023')).toEqual([
      {
        courseTeacherId: '5e4b0f4a-0d1e-4a3f-9c2b-7a1c8d6e5f40',
        courseCode: 'CS2023',
        teacherEmail: 'bojeda@utec.edu.pe',
        teacherName: 'Ojeda Rios, Brenner Humberto',
        averageRating: 4.3,
        ratingCount: 12,
        commentCount: 5,
        recommendPercentage: 83,
      },
    ]);
  });

  it('consulta la vista filtrando por el curso recibido', async () => {
    const { client, calls } = fakeClient([]);

    await getCourseSummaries(client, 'CS1101');

    expect(calls.table).toBe('teacher_course_summaries');
    expect(calls.filters).toEqual([['course_code', 'CS1101']]);
  });

  it('devuelve varias entradas, una por docente del curso', async () => {
    // El `group by` de la vista ya colapsa el par docente–curso (FR-009, FR-011):
    // acá cada fila es un docente distinto.
    const { client } = fakeClient([
      row(),
      row({ course_teacher_id: 'b1', teacher_email: 'mcueva@utec.edu.pe' }),
    ]);

    const summaries = await getCourseSummaries(client, 'CS2023');

    expect(summaries.map((summary) => summary.teacherEmail)).toEqual([
      'bojeda@utec.edu.pe',
      'mcueva@utec.edu.pe',
    ]);
  });

  it('devuelve lista vacía cuando el curso no tiene resúmenes', async () => {
    const { client } = fakeClient([]);
    expect(await getCourseSummaries(client, 'CS2023')).toEqual([]);
  });

  it('falla con un mensaje en español cuando la consulta falla', async () => {
    const { client } = fakeClient([], { message: 'permission denied' });

    await expect(getCourseSummaries(client, 'CS2023')).rejects.toThrow(
      /No se pudieron cargar los resúmenes del curso CS2023/
    );
  });
});
