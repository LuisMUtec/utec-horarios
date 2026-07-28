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
