import type { Career, CareersResponse } from '@/lib/careers';
import type { Profile, ProfileErrors, ProfileResponse, ProfileUpdate } from '@/lib/profile';
import type { ReviewDraft, ReviewErrors } from '@/lib/review-submit';
import type {
  CourseSummariesResponse,
  OwnReview,
  PairReviewsResponse,
  PublishedReviewResponse,
  TeacherSummary,
} from '@/types/reviews';

/**
 * Fetch tipado a `/api/*` desde los componentes, con caché por curso que vive
 * lo que dure la pestaña (D1).
 *
 * Lo cacheado es la promesa en vuelo, no el resultado: dos secciones del mismo
 * curso desplegadas a la vez se enganchan al mismo request.
 */

const summariesByCourse = new Map<string, Promise<TeacherSummary[]>>();

/** Misma normalización que `teacherPairKey`: `cs2023` y `CS2023` son un curso. */
function courseKey(courseCode: string): string {
  return courseCode.trim().toUpperCase();
}

async function requestCourseSummaries(code: string): Promise<TeacherSummary[]> {
  const response = await fetch(`/api/courses/${encodeURIComponent(code)}/summaries`);
  if (!response.ok) {
    throw new Error(`No se pudieron cargar los resúmenes de ${code} (${response.status})`);
  }
  const body = (await response.json()) as CourseSummariesResponse;
  return body.summaries;
}

export async function fetchCourseSummaries(courseCode: string): Promise<TeacherSummary[]> {
  const key = courseKey(courseCode);
  const cached = summariesByCourse.get(key);
  if (cached) return cached;

  const pending = requestCourseSummaries(key).catch((error: unknown) => {
    // Un fallo transitorio no puede congelar el curso hasta que se recargue la
    // pestaña. La comparación por identidad protege al request que haya
    // arrancado después de un invalidateCourse.
    if (summariesByCourse.get(key) === pending) summariesByCourse.delete(key);
    throw error;
  });
  summariesByCourse.set(key, pending);
  return pending;
}

/** Fuerza el próximo fetch del curso; la llaman las mutaciones (SC-005). */
export function invalidateCourse(courseCode: string): void {
  summariesByCourse.delete(courseKey(courseCode));
}

/** La caché es de módulo: sin esto un test arrastra lo que pidió el anterior. */
export function clearSummaryCache(): void {
  summariesByCourse.clear();
}

/** El catálogo es el mismo para todos y no cambia en lo que dura una pestaña. */
let careersRequest: Promise<Career[]> | null = null;

export async function fetchCareers(): Promise<Career[]> {
  if (careersRequest) return careersRequest;

  const pending = (async () => {
    const response = await fetch('/api/careers');
    if (!response.ok) {
      throw new Error(`No se pudo cargar el catálogo de carreras (${response.status})`);
    }
    const body = (await response.json()) as CareersResponse;
    return body.careers;
  })().catch((error: unknown) => {
    if (careersRequest === pending) careersRequest = null;
    throw error;
  });

  careersRequest = pending;
  return pending;
}

export function clearCareersCache(): void {
  careersRequest = null;
}

/**
 * Guardar el perfil tiene dos desenlaces esperables —guardado, o rechazado con
 * el detalle por campo— y ninguno de los dos es una excepción. Lo que sí se
 * lanza es que el pedido no llegue o el servidor se caiga.
 */
export type ProfileSaveResult =
  | { ok: true; profile: Profile }
  | { ok: false; errors: ProfileErrors };

/** El mensaje de la sanción se arma con lo que manda el servidor y no con una
 *  copia local del texto, que se separaría de FR-057 en cuanto cambie. */
function bannedError(body: { error?: string; reason?: string }): ProfileErrors {
  const message = [body.error, body.reason && `Motivo: ${body.reason}`]
    .filter(Boolean)
    .join(' ');

  return { form: message || 'No se pudo guardar el perfil.' };
}

export async function updateProfile(update: ProfileUpdate): Promise<ProfileSaveResult> {
  const response = await fetch('/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });

  if (response.status === 400) {
    const body = (await response.json()) as { errors?: ProfileErrors };
    return { ok: false, errors: body.errors ?? {} };
  }

  // FR-057: quien fue sancionado con la página abierta tiene que leer el motivo,
  // no un fallo genérico.
  if (response.status === 403) {
    return { ok: false, errors: bannedError(await response.json()) };
  }

  if (!response.ok) {
    throw new Error(`No se pudo guardar el perfil (${response.status})`);
  }

  const body = (await response.json()) as ProfileResponse;
  if (body.banned) return { ok: false, errors: bannedError({ reason: body.reason }) };

  return { ok: true, profile: body.profile };
}

/**
 * Los cuatro desenlaces del detalle de un par. `anonymous` y `banned` no son
 * fallos: son las dos pantallas que FR-013 y FR-057 exigen mostrar, y por eso
 * no viajan como excepción.
 */
export type PairReviewsResult =
  | { kind: 'ok'; reviews: PairReviewsResponse }
  | { kind: 'anonymous' }
  | { kind: 'banned'; reason: string }
  | { kind: 'missing' };

/** Sin caché a propósito: la respuesta depende de quién pregunta —lleva la
 *  reseña propia y la vista le esconde lo que reportó (FR-046)—, y después de
 *  publicar tiene que reflejarlo (SC-005). */
export async function fetchPairReviews(
  courseCode: string,
  teacherEmail: string
): Promise<PairReviewsResult> {
  const query = new URLSearchParams({ course: courseKey(courseCode), teacher: teacherEmail });
  const response = await fetch(`/api/reviews?${query}`);

  if (response.status === 401) return { kind: 'anonymous' };
  if (response.status === 404) return { kind: 'missing' };

  if (response.status === 403) {
    const body = (await response.json()) as { reason?: string };
    return { kind: 'banned', reason: body.reason ?? '' };
  }

  if (!response.ok) {
    throw new Error(`No se pudieron cargar las reseñas (${response.status})`);
  }

  return { kind: 'ok', reviews: (await response.json()) as PairReviewsResponse };
}

/**
 * Los desenlaces de publicar. Solo `unavailable` es un fallo del sistema; los
 * demás son respuestas que el estudiante tiene que poder leer y distinguir:
 * «ya reseñaste este par» no se parece en nada a «alcanzaste el límite».
 */
export type PublishReviewResult =
  | { kind: 'published'; review: OwnReview }
  | { kind: 'invalid'; errors: ReviewErrors }
  /** FR-027, escenario 16. `own` es lo que ya había publicado. */
  | { kind: 'duplicate'; own: OwnReview | null }
  /** FR-030. `releaseAt` alimenta el texto de FR-031. */
  | { kind: 'rate_limit'; releaseAt: string | null; message: string }
  /** FR-028: el par salió de la oferta mientras la página estaba abierta. */
  | { kind: 'not_current' }
  /** La sesión se cayó mientras escribía: lo elegido no se pierde. */
  | { kind: 'anonymous' }
  | { kind: 'banned'; reason: string };

/**
 * Publica y deja el resumen del curso listo para volver a pedirse. La
 * invalidación va acá y no en el componente porque es lo que sostiene SC-005 en
 * la pestaña del autor, que es donde más se nota que el promedio no cambió.
 */
export async function publishReview(
  courseCode: string,
  teacherEmail: string,
  draft: ReviewDraft
): Promise<PublishReviewResult> {
  const response = await fetch('/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ course: courseKey(courseCode), teacher: teacherEmail, ...draft }),
  });

  if (response.status === 201) {
    invalidateCourse(courseCode);
    const body = (await response.json()) as PublishedReviewResponse;
    return { kind: 'published', review: body.review };
  }

  if (response.status === 401) return { kind: 'anonymous' };

  if (response.status === 403) {
    const body = (await response.json()) as { reason?: string };
    return { kind: 'banned', reason: body.reason ?? '' };
  }

  if (response.status === 400) {
    const body = (await response.json()) as { errors?: ReviewErrors };
    return { kind: 'invalid', errors: body.errors ?? {} };
  }

  if (response.status === 409) {
    const body = (await response.json()) as { own?: OwnReview | null };
    return { kind: 'duplicate', own: body.own ?? null };
  }

  if (response.status === 429) {
    const body = (await response.json()) as { releaseAt?: string | null; error?: string };
    return {
      kind: 'rate_limit',
      releaseAt: body.releaseAt ?? null,
      message: body.error ?? '',
    };
  }

  if (response.status === 404) return { kind: 'not_current' };

  throw new Error(`No se pudo publicar la reseña (${response.status})`);
}
