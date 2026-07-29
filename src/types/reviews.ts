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

/**
 * Un comentario tal como se lista (FR-035). Nada del autor no es una omisión al
 * serializar: `review_comments` no expone `author_id`, así que no hay de dónde
 * sacarlo (SC-006).
 */
export interface PairComment {
  /** Es el id de la reseña, que es la unidad reportable de FR-042. */
  id: string;
  rating: number;
  recommends: boolean;
  comment: string;
  /** `comment_published_at`, no `published_at` (FR-064, D2). */
  publishedAt: string;
  /** Con valor, la fila lleva la marca `editado` (FR-055). */
  editedAt: string | null;
}

/** La reseña propia del par, para que US4 y US5 sepan si ya existe. */
export interface OwnReview {
  id: string;
  rating: number;
  recommends: boolean;
  comment: string | null;
  publishedAt: string;
  commentPublishedAt: string | null;
  commentEditedAt: string | null;
}

/** Respuesta de `POST /api/reviews` cuando la reseña entró. */
export interface PublishedReviewResponse {
  review: OwnReview;
}

/** Respuesta de `GET /api/reviews?course=&teacher=`. Exige sesión (FR-013). */
export interface PairReviewsResponse {
  /** Lo necesita US4 para publicar contra el par, y no identifica a nadie. */
  courseTeacherId: string;
  comments: PairComment[];
  own: OwnReview | null;
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
