/**
 * Validación de una reseña antes de publicarla (FR-021, FR-061).
 *
 * La comparten el formulario y el route handler. La del handler es la que
 * cuenta; la del formulario existe para no hacer viajar un error evitable.
 *
 * Sin comentario: puntuar y recomendar no exige carrera, ciclo ni compromiso de
 * respeto (SC-003). US4b añade esas tres cosas cuando hay texto.
 */

import { RATING_SCALE_MAX } from '@/lib/review-format';

export const RATING_MIN = 1;
export const RATING_MAX = RATING_SCALE_MAX;

/** FR-021. El texto exacto de la casilla. */
export const ATTENDANCE_LABEL = 'Declaro que llevé este curso con este docente';

/**
 * FR-004: la puntuación mide la experiencia académica, no lo fácil que fue el
 * curso. La pregunta lo dice para que nadie tenga que suponerlo de las estrellas.
 */
export const RATING_QUESTION = '¿Cómo fue tu experiencia académica con este docente?';

/** FR-061. El texto exacto de la pregunta, y sus dos únicas respuestas. */
export const RECOMMEND_QUESTION = '¿Recomendarías llevar este curso con este docente?';
export const RECOMMEND_YES_LABEL = 'Sí';
export const RECOMMEND_NO_LABEL = 'No';

/**
 * Escenario 14 y FR-041. Es la explicación de para qué sirve el espacio, no un
 * «marca la casilla»: quien llega a preguntar algo tiene que leer que acá no va.
 */
export const MISSING_ATTENDANCE_MESSAGE =
  'Este espacio recoge experiencias de alumnos que ya llevaron el curso con ese docente. ' +
  'No admite preguntas, solicitudes de información ni expresiones de interés.';

export const MISSING_RATING_MESSAGE = `Elige una puntuación de ${RATING_MIN} a ${RATING_MAX} estrellas.`;

/** FR-061: obligatoria y sin valor preseleccionado, así que faltar es lo normal. */
export const MISSING_RECOMMENDATION_MESSAGE =
  'Responde si recomendarías llevar este curso con este docente.';

/**
 * Edge case *Pérdida de sesión durante la publicación*: se dice que no entró y
 * que lo elegido sigue en pantalla, porque el formulario no se desmonta.
 */
export const SESSION_LOST_MESSAGE =
  'Tu sesión se cerró antes de publicar. Inicia sesión y vuelve a intentarlo: lo que elegiste sigue acá.';

/** Escenario 19: la confirmación de que entró. Es momentánea —va en un aviso
 *  que se cierra solo—, porque lo permanente ya es el promedio actualizado. */
export const PUBLISHED_MESSAGE = 'Listo. Tu puntuación ya cuenta en el promedio de este docente.';

/** FR-027, escenario 16. Lo levanta el índice único, no una comprobación previa. */
export const DUPLICATE_REVIEW_MESSAGE = 'Ya publicaste una reseña de este docente en este curso.';

/** FR-027: quien ya contribuyó ve lo que publicó. Editarlo llega con US5. */
export const OWN_REVIEW_TITLE = 'Tu reseña';

/** Lo que el formulario tiene en pantalla. Los tres arrancan sin elegir. */
export interface ReviewDraft {
  declaredAttendance: boolean;
  rating: number | null;
  recommends: boolean | null;
}

export const EMPTY_REVIEW_DRAFT: ReviewDraft = {
  declaredAttendance: false,
  rating: null,
  recommends: null,
};

/** Lo validado, listo para insertar. `declaredAttendance` es `true` por tipo:
 *  la columna lleva un check que solo acepta ese valor. */
export interface ReviewSubmission {
  rating: number;
  recommends: boolean;
  declaredAttendance: true;
}

export type ReviewErrors = {
  declaredAttendance?: string;
  rating?: string;
  recommends?: string;
  /** Lo que no es de un campo concreto: cuerpo inválido. */
  form?: string;
};

export type ReviewValidation =
  | { ok: true; value: ReviewSubmission }
  | { ok: false; errors: ReviewErrors };

/**
 * Entero de 1 a 5 y nada más. No se acepta el texto de un `<input>` como en el
 * ciclo del perfil: las estrellas son botones y siempre mandan número, así que
 * un string acá solo puede venir de fuera del formulario.
 */
function isValidRating(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= RATING_MIN &&
    value <= RATING_MAX
  );
}

/**
 * Valida tanto el borrador del formulario como el cuerpo crudo del handler: los
 * dos entran por acá para que no haya dos definiciones de reseña publicable.
 *
 * Los errores se acumulan, no se cortan en el primero: el escenario 15 pide que
 * se le indiquen al estudiante los requisitos pendientes, en plural.
 */
export function validateReviewSubmission(raw: unknown): ReviewValidation {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: { form: 'El cuerpo del pedido no es válido.' } };
  }

  const body = raw as Record<string, unknown>;
  const errors: ReviewErrors = {};

  // FR-021: la declaración es el único respaldo de que llevó el curso, así que
  // se exige `true` explícito y no un valor que solo parezca afirmativo.
  if (body.declaredAttendance !== true) {
    errors.declaredAttendance = MISSING_ATTENDANCE_MESSAGE;
  }

  if (!isValidRating(body.rating)) {
    errors.rating = MISSING_RATING_MESSAGE;
  }

  // FR-061. `null` es «todavía no respondió» y `false` es «No»: distinguirlos es
  // justo lo que separa una recomendación negativa de una sin responder.
  if (typeof body.recommends !== 'boolean') {
    errors.recommends = MISSING_RECOMMENDATION_MESSAGE;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      rating: body.rating as number,
      recommends: body.recommends as boolean,
      declaredAttendance: true,
    },
  };
}

/** Lo que el formulario usa para saber si habilitar el botón, sin armar errores. */
export function isReviewDraftComplete(draft: ReviewDraft): boolean {
  return validateReviewSubmission(draft).ok;
}
