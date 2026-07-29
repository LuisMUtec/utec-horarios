import { describe, it, expect } from 'vitest';
import {
  EMPTY_REVIEW_DRAFT,
  MISSING_ATTENDANCE_MESSAGE,
  MISSING_RATING_MESSAGE,
  MISSING_RECOMMENDATION_MESSAGE,
  RATING_MAX,
  RATING_MIN,
  isReviewDraftComplete,
  validateReviewSubmission,
  type ReviewDraft,
} from '@/lib/review-submit';

/** Una reseña publicable, para partir de ahí y quitarle una cosa por test. */
const complete = (partial: Partial<ReviewDraft> = {}): ReviewDraft => ({
  declaredAttendance: true,
  rating: 4,
  recommends: true,
  ...partial,
});

describe('validateReviewSubmission — declaración de experiencia (FR-021)', () => {
  it('publica cuando la declaración, la puntuación y la recomendación están', () => {
    expect(validateReviewSubmission(complete())).toEqual({
      ok: true,
      value: { rating: 4, recommends: true, declaredAttendance: true },
    });
  });

  // Escenario 14: no basta con negarse, hay que explicar para qué es el espacio.
  it('no publica sin la declaración, y explica que no es un espacio para preguntas', () => {
    const result = validateReviewSubmission(complete({ declaredAttendance: false }));

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors.declaredAttendance).toBe(
      MISSING_ATTENDANCE_MESSAGE
    );
    expect(MISSING_ATTENDANCE_MESSAGE).toContain('preguntas');
  });

  it.each([['sí'], [1], [null], [undefined]])(
    'no acepta %s como declaración: solo `true` la da por hecha',
    (declaredAttendance) => {
      const result = validateReviewSubmission({ ...complete(), declaredAttendance });

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.errors.declaredAttendance).toBe(
        MISSING_ATTENDANCE_MESSAGE
      );
    }
  );
});

describe('validateReviewSubmission — puntuación', () => {
  it.each([1, 2, 3, 4, 5])('acepta %i estrellas', (rating) => {
    expect(validateReviewSubmission(complete({ rating })).ok).toBe(true);
  });

  it('no publica sin puntuación', () => {
    const result = validateReviewSubmission(complete({ rating: null }));

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors.rating).toBe(MISSING_RATING_MESSAGE);
  });

  it.each([0, 6, -1, 4.5, Number.NaN, '5'])(
    'rechaza %s: la escala es de %i a %i y entera',
    (rating) => {
      const result = validateReviewSubmission({ ...complete(), rating });

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.errors.rating).toBe(MISSING_RATING_MESSAGE);
    }
  );

  it('el mensaje nombra los extremos de la escala', () => {
    expect(MISSING_RATING_MESSAGE).toContain(String(RATING_MIN));
    expect(MISSING_RATING_MESSAGE).toContain(String(RATING_MAX));
  });
});

describe('validateReviewSubmission — recomendación (FR-061, escenario 37)', () => {
  it('acepta `No` como respuesta, que no es lo mismo que no responder', () => {
    const result = validateReviewSubmission(complete({ recommends: false }));

    expect(result).toEqual({
      ok: true,
      value: { rating: 4, recommends: false, declaredAttendance: true },
    });
  });

  it('no publica sin responder la recomendación', () => {
    const result = validateReviewSubmission(complete({ recommends: null }));

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors.recommends).toBe(
      MISSING_RECOMMENDATION_MESSAGE
    );
  });

  it.each([['sí'], [1], [0], [undefined]])('rechaza %s: la respuesta es booleana', (recommends) => {
    const result = validateReviewSubmission({ ...complete(), recommends });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors.recommends).toBe(
      MISSING_RECOMMENDATION_MESSAGE
    );
  });
});

describe('validateReviewSubmission — cuerpo del pedido', () => {
  it.each([[null], ['{}'], [[]], [42]])('rechaza %s como cuerpo', (body) => {
    const result = validateReviewSubmission(body);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors.form).toBeTruthy();
  });

  // Escenario 15: los requisitos pendientes se indican en plural.
  it('acumula los tres errores en lugar de cortar en el primero', () => {
    const result = validateReviewSubmission(EMPTY_REVIEW_DRAFT);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors).toEqual({
      declaredAttendance: MISSING_ATTENDANCE_MESSAGE,
      rating: MISSING_RATING_MESSAGE,
      recommends: MISSING_RECOMMENDATION_MESSAGE,
    });
  });

  it('no deja pasar columnas que el formulario no maneja', () => {
    const result = validateReviewSubmission({
      ...complete(),
      comment: 'texto',
      published_at: '2020-01-01T00:00:00Z',
      state: 'active',
    });

    expect(result).toEqual({
      ok: true,
      value: { rating: 4, recommends: true, declaredAttendance: true },
    });
  });
});

describe('isReviewDraftComplete', () => {
  it('arranca en falso: los tres campos empiezan sin elegir', () => {
    expect(isReviewDraftComplete(EMPTY_REVIEW_DRAFT)).toBe(false);
  });

  it('es cierto con la declaración, la puntuación y la recomendación', () => {
    expect(isReviewDraftComplete(complete())).toBe(true);
  });

  it.each([
    ['la declaración', complete({ declaredAttendance: false })],
    ['la puntuación', complete({ rating: null })],
    ['la recomendación', complete({ recommends: null })],
  ])('es falso si falta %s', (_, draft) => {
    expect(isReviewDraftComplete(draft)).toBe(false);
  });
});
