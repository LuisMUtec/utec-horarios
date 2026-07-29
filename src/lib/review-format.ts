/**
 * Textos y formatos del resumen de un docente. Sin JSX ni red: los componentes
 * de reseñas no arman texto por su cuenta.
 */

import type { SummaryState, TeacherSummary } from '@/types/reviews';

/** FR-003. */
export const RATING_SCALE_MAX = 5;

/** FR-030. */
export const DAILY_RATING_LIMIT = 8;

/** FR-007: hay docente, nadie lo evaluó. */
export const EMPTY_SUMMARY_LABEL = 'Sin puntuaciones';

/** FR-054: no hay a quién evaluar. No es intercambiable con el anterior (SC-002). */
export const UNASSIGNED_TEACHER_LABEL = 'Docente por asignar';

/** SC-002 también lo separa de los dos anteriores. */
export const ERROR_SUMMARY_LABEL = 'No se pudieron cargar las reseñas';

export const NO_COMMENTS_LABEL = 'Aún no hay comentarios';

/** Acompaña al porcentaje (FR-058). Habla de recomendación, no de dificultad (FR-062). */
export const RECOMMEND_LABEL = 'lo recomienda';

/** FR-055. */
export const EDITED_LABEL = 'editado';

const LOADING_LABEL = 'Cargando reseñas';

/** `numeric` y `bigint` llegan como string o como number según el transporte. */
export function readNumber(value: number | string | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  // `Number('')` es 0, así que la cadena vacía se descarta antes de convertir.
  const trimmed = value.trim();
  if (trimmed === '') return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Promedio de 1 a 5 con un decimal (FR-003). `null` si no hay número que mostrar. */
export function formatAverageRating(value: number | string | null | undefined): string | null {
  const rating = readNumber(value);
  return rating === null ? null : rating.toFixed(1);
}

/** Porcentaje entero, sin decimales (FR-059). */
export function formatRecommendPercentage(
  value: number | string | null | undefined
): string | null {
  const percentage = readNumber(value);
  return percentage === null ? null : `${Math.round(percentage)}%`;
}

/** Ancho de la capa llena de estrellas, en porcentaje de la escala (FR-003). */
export function ratingFillPercentage(value: number | string | null | undefined): number {
  const rating = readNumber(value) ?? 0;
  const fill = Math.round((rating / RATING_SCALE_MAX) * 100);
  return Math.min(100, Math.max(0, fill));
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** FR-005. */
export function formatRatingCount(value: number | string | null | undefined): string {
  return pluralize(readNumber(value) ?? 0, 'puntuación', 'puntuaciones');
}

/** FR-006. Sin comentarios no se muestra un cero, se muestra el estado vacío. */
export function formatCommentCount(value: number | string | null | undefined): string {
  const count = readNumber(value) ?? 0;
  return count === 0 ? NO_COMMENTS_LABEL : pluralize(count, 'comentario', 'comentarios');
}

/** FR-055: la marca acompaña a la fecha de publicación, no la reemplaza. */
export function formatEditedMark(editedAt: string | Date | null | undefined): string | null {
  return editedAt ? EDITED_LABEL : null;
}

const COMMENT_DATE_PARTS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
};

/**
 * La fecha visible de un comentario (FR-035, FR-064).
 *
 * Con año porque la lista mezcla ciclos y «12 de marzo» no dice de cuál. Sin
 * hora porque el minuto no le sirve a quien lee y sí ayuda a correlacionar un
 * comentario con quien lo escribió.
 */
export function formatCommentDate(
  value: string | Date | null | undefined,
  timeZone?: string
): string | null {
  if (value === null || value === undefined) return null;

  const at = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(at.getTime())) return null;

  return new Intl.DateTimeFormat('es-PE', { ...COMMENT_DATE_PARTS, timeZone }).format(at);
}

function summaryAriaParts(summary: TeacherSummary): string {
  const average = formatAverageRating(summary.averageRating);
  const percentage = formatRecommendPercentage(summary.recommendPercentage);

  return [
    average === null ? null : `${average} de ${RATING_SCALE_MAX} estrellas`,
    formatRatingCount(summary.ratingCount),
    percentage === null ? null : `${percentage} ${RECOMMEND_LABEL}`,
    formatCommentCount(summary.commentCount),
  ]
    .filter((part): part is string => part !== null)
    .join(', ');
}

/**
 * Texto equivalente del resumen: en pantalla es una fila de fragmentos sueltos
 * y las estrellas son decorativas, así que el lector de pantalla necesita esta
 * versión completa. Cada estado dice algo distinto (SC-002).
 */
export function formatSummaryAriaLabel(teacherName: string, state: SummaryState): string {
  const name = teacherName.trim();
  const prefix = name === '' ? '' : `${name}: `;

  switch (state.kind) {
    case 'summary':
      return `${prefix}${summaryAriaParts(state.summary)}.`;
    case 'empty':
      return `${prefix}${EMPTY_SUMMARY_LABEL}.`;
    // Sin nombre que anteponer: el estado existe porque no hay docente.
    case 'unassigned':
      return `${UNASSIGNED_TEACHER_LABEL}.`;
    case 'loading':
      return `${prefix}${LOADING_LABEL}.`;
    case 'error':
      return `${prefix}${ERROR_SUMMARY_LABEL}.`;
  }
}

const DATE_PARTS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };

// h23 para no depender de cómo cada versión de ICU escribe "p. m.".
const TIME_PARTS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
};

/** `timeZone` sólo lo fija el test; sin él manda la zona local de quien mira. */
function formatInstant(value: Date | string | number, timeZone?: string): string | null {
  const at = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(at.getTime())) return null;

  const day = new Intl.DateTimeFormat('es-PE', { ...DATE_PARTS, timeZone }).format(at);
  const time = new Intl.DateTimeFormat('es-PE', { ...TIME_PARTS, timeZone }).format(at);
  return `${day} a las ${time}`;
}

/** FR-031: el bloqueo se explica con el instante en que vuelve a haber cupo. */
export function formatRatingLimitMessage(
  releaseAt: Date | string | number,
  timeZone?: string
): string {
  const cap = `Alcanzaste el límite de ${formatRatingCount(DAILY_RATING_LIMIT)} en 24 horas.`;
  const at = formatInstant(releaseAt, timeZone);

  return at === null
    ? `${cap} Vuelve a intentarlo más tarde.`
    : `${cap} Podrás volver a publicar el ${at}.`;
}
