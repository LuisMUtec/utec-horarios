/**
 * Qué docentes tiene una sección y qué resumen le toca a cada uno.
 *
 * Vive fuera del componente porque es lo único testeable de la integración:
 * SectionSelector se queda con el JSX y el fetch.
 */

import { normalizeTeacherEmail, teacherPairKey } from '@/lib/teacher-email';
import type { Session } from '@/types';
import type { SummaryState, TeacherSummary } from '@/types/reviews';

export interface SectionTeacher {
  /** Identidad dentro de la sección, también para deduplicar y para React. */
  key: string;
  /** Par docente–curso, o `null` si la sesión no trae correo (FR-054). */
  pairKey: string | null;
  /** El correo ya normalizado, que es lo que pide `/api/reviews`. Va aparte de
   *  `pairKey` para no tener que volver a partirla por el separador. */
  email: string | null;
  /** Solo para mostrar: la identidad es el correo (FR-053). */
  name: string;
}

/**
 * Igual que `analyzeSection`, el resultado se cachea por identidad del arreglo:
 * las sesiones salen de courses.json importado, no cambian, y cada arreglo
 * pertenece a un único curso, así que `courseCode` no hace falta en la llave.
 * Sin esto se re-normalizan todos los correos en cada re-render por hover.
 */
const teachersBySessions = new WeakMap<Session[], SectionTeacher[]>();

/** Un docente por par, aunque dicte varias sesiones de la sección (FR-009). */
export function sectionTeachers(courseCode: string, sessions: Session[]): SectionTeacher[] {
  const cached = teachersBySessions.get(sessions);
  if (cached) return cached;

  const byKey = new Map<string, SectionTeacher>();

  for (const session of sessions) {
    const name = (session.professor ?? '').trim();
    const email = normalizeTeacherEmail(session.email);
    const pairKey = email === null ? null : teacherPairKey(courseCode, email);
    // Sin correo no hay par sobre el cual agregar: quedan separados por nombre.
    const key = pairKey ?? `sin-correo|${name.toLowerCase()}`;
    if (!byKey.has(key)) byKey.set(key, { key, pairKey, email, name });
  }

  const teachers = [...byKey.values()];
  teachersBySessions.set(sessions, teachers);
  return teachers;
}

/** Lo que la sección sabe de los resúmenes del curso. `disabled` es la app sin Supabase. */
export type CourseSummaryState =
  | { kind: 'disabled' }
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; byPairKey: Map<string, TeacherSummary> };

/** Un índice por par para todo el curso: dos secciones con el mismo docente
 *  aciertan la misma entrada (FR-011). */
export function indexSummaries(summaries: TeacherSummary[]): Map<string, TeacherSummary> {
  return new Map(
    summaries.map((summary) => [
      teacherPairKey(summary.courseCode, summary.teacherEmail),
      summary,
    ])
  );
}

/**
 * Si la fila ofrece abrir el detalle de comentarios (T062).
 *
 * Sin correo no hay par que consultar (FR-054). Mientras el resumen no esté
 * resuelto tampoco: ofrecer un detalle que puede responder 404 confunde más de
 * lo que adelanta.
 */
export function canOpenDetail(teacher: SectionTeacher, state: SummaryState | null): boolean {
  if (teacher.email === null || state === null) return false;
  return state.kind === 'summary' || state.kind === 'empty';
}

/** `null` es no renderizar nada: la app sin Supabase se ve como antes de las reseñas. */
export function teacherSummaryState(
  teacher: SectionTeacher,
  course: CourseSummaryState
): SummaryState | null {
  if (course.kind === 'disabled') return null;
  // Antes que carga o fallo: no hay a quién evaluar, no hay nada que esperar.
  if (teacher.pairKey === null) return { kind: 'unassigned' };
  if (course.kind !== 'ready') return { kind: course.kind };

  const summary = course.byPairKey.get(teacher.pairKey);
  return summary ? { kind: 'summary', summary } : { kind: 'empty' };
}
