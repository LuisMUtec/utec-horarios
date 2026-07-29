/** Tipos de la aplicación para reseñas. No son las filas de la base: lo que
 *  viaja al navegador se decide acá y no en el esquema. */

/** Una fila de `teacher_course_summaries` ya proyectada (FR-002, FR-008). */
export interface TeacherSummary {
  courseTeacherId: string;
  courseCode: string;
  teacherEmail: string;
  teacherName: string;
  /** Escala 1–5 con un decimal (FR-003). */
  averageRating: number;
  ratingCount: number;
  commentCount: number;
  /** Entero 0–100 (FR-059). */
  recommendPercentage: number;
}

/** Respuesta de `GET /api/courses/[code]/summaries`. Sin sesión (FR-008). */
export interface CourseSummariesResponse {
  summaries: TeacherSummary[];
}

/** Lo que la UI muestra junto a un docente. Los tres estados son distinguibles
 *  entre sí a propósito: SC-002 lo exige. */
export type SummaryState =
  /** Hay docente y tiene reseñas. */
  | { kind: 'summary'; summary: TeacherSummary }
  /** Hay docente, nadie lo evaluó (FR-058). */
  | { kind: 'empty' }
  /** La sesión no tiene correo recuperable (FR-054). */
  | { kind: 'unassigned' }
  | { kind: 'loading' }
  | { kind: 'error' };
