import type { Career, CareersResponse } from '@/lib/careers';
import type { Profile, ProfileErrors, ProfileResponse, ProfileUpdate } from '@/lib/profile';
import type { CourseSummariesResponse, TeacherSummary } from '@/types/reviews';

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
