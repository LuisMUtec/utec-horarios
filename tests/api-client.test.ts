import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  clearCareersCache,
  clearSummaryCache,
  fetchCareers,
  fetchCourseSummaries,
  fetchPairReviews,
  invalidateCourse,
  updateProfile,
} from '@/lib/api-client';
import type { Career } from '@/lib/careers';
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
  clearCareersCache();
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

const CAREERS: Career[] = [{ slug: 'fisica', name: 'Física', faculty: 'Ciencias Básicas' }];

describe('fetchCareers', () => {
  it('pide el catálogo una sola vez por pestaña', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ careers: CAREERS }) });

    await expect(fetchCareers()).resolves.toEqual(CAREERS);
    await fetchCareers();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/careers');
  });

  it('engancha dos llamadas concurrentes al mismo request', async () => {
    const inFlight = deferredResponse();
    fetchMock.mockReturnValue(inFlight.promise);

    const first = fetchCareers();
    const second = fetchCareers();
    inFlight.settle({ ok: true, status: 200, json: async () => ({ careers: CAREERS }) });

    expect(await first).toEqual(CAREERS);
    expect(await second).toEqual(CAREERS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('no cachea un fallo', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(503));
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ careers: CAREERS }),
    });

    await expect(fetchCareers()).rejects.toThrow('503');
    await expect(fetchCareers()).resolves.toEqual(CAREERS);
  });
});

const PROFILE = { careerSlug: 'fisica', careerName: 'Física', term: 5 };

function profileResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe('updateProfile', () => {
  it('manda un PATCH con el cuerpo en JSON y devuelve el perfil guardado', async () => {
    fetchMock.mockResolvedValue(profileResponse(200, { banned: false, profile: PROFILE }));

    await expect(updateProfile({ term: 5 })).resolves.toEqual({ ok: true, profile: PROFILE });
    expect(fetchMock).toHaveBeenCalledWith('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{"term":5}',
    });
  });

  it('un 400 devuelve los errores por campo, no una excepción', async () => {
    fetchMock.mockResolvedValue(
      profileResponse(400, { errors: { term: 'El ciclo va del 1 al 10.' } })
    );

    await expect(updateProfile({ term: 99 })).resolves.toEqual({
      ok: false,
      errors: { term: 'El ciclo va del 1 al 10.' },
    });
  });

  it('un 400 sin cuerpo útil no rompe el formulario', async () => {
    fetchMock.mockResolvedValue(profileResponse(400, {}));
    await expect(updateProfile({ term: 99 })).resolves.toEqual({ ok: false, errors: {} });
  });

  // FR-057: quien fue sancionado con la página abierta tiene que leer el motivo.
  it('un 403 devuelve el mensaje y el motivo que mandó el servidor', async () => {
    fetchMock.mockResolvedValue(
      profileResponse(403, {
        error: 'Tu acceso a las reseñas fue retirado de forma permanente.',
        banned: true,
        reason: 'Insultos hacia un docente.',
      })
    );

    const result = await updateProfile({ term: 5 });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors.form).toBe(
      'Tu acceso a las reseñas fue retirado de forma permanente. Motivo: Insultos hacia un docente.'
    );
  });

  it('lanza cuando el servidor falla de verdad', async () => {
    fetchMock.mockResolvedValue(profileResponse(503, {}));
    await expect(updateProfile({ term: 5 })).rejects.toThrow('503');
  });
});

const PAIR_REVIEWS = {
  courseTeacherId: 'par-1',
  comments: [
    {
      id: 'r-1',
      rating: 4,
      recommends: true,
      comment: 'Explica con calma.',
      publishedAt: '2026-05-12T15:04:05Z',
      editedAt: null,
    },
  ],
  own: null,
};

describe('fetchPairReviews', () => {
  it('pide el par por curso y correo', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => PAIR_REVIEWS });

    await expect(fetchPairReviews('cs2023', 'bojeda@utec.edu.pe')).resolves.toEqual({
      kind: 'ok',
      reviews: PAIR_REVIEWS,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/reviews?course=CS2023&teacher=bojeda%40utec.edu.pe'
    );
  });

  // FR-013: el 401 no es un fallo, es la pantalla que pide iniciar sesión.
  it('un 401 es el estado anónimo, no una excepción', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    await expect(fetchPairReviews('CS2023', 'bojeda@utec.edu.pe')).resolves.toEqual({
      kind: 'anonymous',
    });
  });

  // FR-057: cada vez que intente leer comentarios, con el motivo.
  it('un 403 trae el motivo de la sanción', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ banned: true, reason: 'Datos personales de un tercero.' }),
    });

    await expect(fetchPairReviews('CS2023', 'bojeda@utec.edu.pe')).resolves.toEqual({
      kind: 'banned',
      reason: 'Datos personales de un tercero.',
    });
  });

  it('un 404 es el par que salió de la oferta', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    await expect(fetchPairReviews('CS2023', 'bojeda@utec.edu.pe')).resolves.toEqual({
      kind: 'missing',
    });
  });

  it('lanza cuando el servidor falla de verdad', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    await expect(fetchPairReviews('CS2023', 'bojeda@utec.edu.pe')).rejects.toThrow('503');
  });

  // Sin caché: la respuesta depende de quién pregunta y de lo que acaba de
  // publicar (SC-005).
  it('no cachea entre llamadas', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => PAIR_REVIEWS });

    await fetchPairReviews('CS2023', 'bojeda@utec.edu.pe');
    await fetchPairReviews('CS2023', 'bojeda@utec.edu.pe');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
