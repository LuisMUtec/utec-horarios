import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchCourseSummaries, invalidateCourse, clearSummaryCache } from '@/lib/api-client';
import type { TeacherSummary } from '@/types/reviews';

const SUMMARY: TeacherSummary = {
  courseTeacherId: '2f9d1b7c-0000-4000-8000-000000000001',
  courseCode: 'CS2023',
  teacherEmail: 'bojeda@utec.edu.pe',
  teacherName: 'Ojeda Rios, Brenner Humberto',
  averageRating: 4.3,
  ratingCount: 12,
  commentCount: 5,
  recommendPercentage: 83,
};

function okResponse(summaries: TeacherSummary[]) {
  return { ok: true, status: 200, json: async () => ({ summaries }) };
}

function errorResponse(status: number) {
  return { ok: false, status, json: async () => ({}) };
}

/** Deja el request colgado para observar lo que pasa mientras está en vuelo. */
function deferredResponse() {
  let settle!: (response: unknown) => void;
  const promise = new Promise<unknown>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  clearSummaryCache();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchCourseSummaries', () => {
  it('pide el curso a su endpoint y devuelve los resúmenes', async () => {
    fetchMock.mockResolvedValue(okResponse([SUMMARY]));

    await expect(fetchCourseSummaries('CS2023')).resolves.toEqual([SUMMARY]);
    expect(fetchMock).toHaveBeenCalledWith('/api/courses/CS2023/summaries');
  });

  it('no vuelve a pedir un curso ya cargado', async () => {
    fetchMock.mockResolvedValue(okResponse([SUMMARY]));

    const first = await fetchCourseSummaries('CS2023');
    const second = await fetchCourseSummaries('CS2023');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('trata el código como el mismo curso sin importar mayúsculas ni espacios', async () => {
    fetchMock.mockResolvedValue(okResponse([SUMMARY]));

    await fetchCourseSummaries('CS2023');
    await fetchCourseSummaries('  cs2023 ');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('dispara un solo fetch para dos llamadas concurrentes del mismo curso', async () => {
    // Dos secciones del mismo curso desplegadas a la vez.
    const inFlight = deferredResponse();
    fetchMock.mockReturnValue(inFlight.promise);

    const first = fetchCourseSummaries('CS2023');
    const second = fetchCourseSummaries('CS2023');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    inFlight.settle(okResponse([SUMMARY]));

    expect(await first).toEqual([SUMMARY]);
    expect(await second).toEqual([SUMMARY]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('mantiene cursos distintos en entradas distintas', async () => {
    fetchMock.mockResolvedValue(okResponse([SUMMARY]));

    await fetchCourseSummaries('CS2023');
    await fetchCourseSummaries('MA1002');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith('/api/courses/MA1002/summaries');
  });

  it('lanza cuando la respuesta no es ok, y no cachea ese fallo', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(500));
    fetchMock.mockResolvedValueOnce(okResponse([SUMMARY]));

    await expect(fetchCourseSummaries('CS2023')).rejects.toThrow('500');
    await expect(fetchCourseSummaries('CS2023')).resolves.toEqual([SUMMARY]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('no cachea un fetch que falló', async () => {
    // Un error de red no puede congelar el curso hasta que se recargue la pestaña.
    fetchMock.mockRejectedValueOnce(new Error('red caída'));
    fetchMock.mockResolvedValueOnce(okResponse([SUMMARY]));

    await expect(fetchCourseSummaries('CS2023')).rejects.toThrow('red caída');
    await expect(fetchCourseSummaries('CS2023')).resolves.toEqual([SUMMARY]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('invalidateCourse', () => {
  it('fuerza el siguiente fetch del curso invalidado', async () => {
    const updated = { ...SUMMARY, ratingCount: 13 };
    fetchMock.mockResolvedValueOnce(okResponse([SUMMARY]));
    fetchMock.mockResolvedValueOnce(okResponse([updated]));

    await fetchCourseSummaries('CS2023');
    invalidateCourse('cs2023');

    await expect(fetchCourseSummaries('CS2023')).resolves.toEqual([updated]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('no toca los demás cursos', async () => {
    fetchMock.mockResolvedValue(okResponse([SUMMARY]));

    await fetchCourseSummaries('CS2023');
    await fetchCourseSummaries('MA1002');
    invalidateCourse('CS2023');
    await fetchCourseSummaries('MA1002');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sobre un curso que nunca se pidió no rompe nada', async () => {
    fetchMock.mockResolvedValue(okResponse([SUMMARY]));

    invalidateCourse('CS2023');

    await expect(fetchCourseSummaries('CS2023')).resolves.toEqual([SUMMARY]);
  });

  it('deja pedir de nuevo aunque se invalide con el request en vuelo', async () => {
    const inFlight = deferredResponse();
    fetchMock.mockReturnValueOnce(inFlight.promise);
    fetchMock.mockResolvedValueOnce(okResponse([SUMMARY]));

    const stale = fetchCourseSummaries('CS2023');
    invalidateCourse('CS2023');
    inFlight.settle(okResponse([]));

    await expect(stale).resolves.toEqual([]);
    await expect(fetchCourseSummaries('CS2023')).resolves.toEqual([SUMMARY]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('clearSummaryCache', () => {
  it('vacía la caché entera', async () => {
    fetchMock.mockResolvedValue(okResponse([SUMMARY]));

    await fetchCourseSummaries('CS2023');
    clearSummaryCache();
    await fetchCourseSummaries('CS2023');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
