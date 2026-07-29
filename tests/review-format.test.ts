import { describe, it, expect } from 'vitest';
import {
  DAILY_RATING_LIMIT,
  EMPTY_SUMMARY_LABEL,
  ERROR_SUMMARY_LABEL,
  NO_COMMENTS_LABEL,
  RATING_SCALE_MAX,
  RECOMMEND_LABEL,
  UNASSIGNED_TEACHER_LABEL,
  formatAverageRating,
  formatCommentCount,
  formatCommentDate,
  formatEditedMark,
  formatRatingCount,
  formatRatingLimitMessage,
  formatStarOptionLabel,
  formatRecommendPercentage,
  formatSummaryAriaLabel,
  ratingFillPercentage,
  readNumber,
} from '@/lib/review-format';
import type { SummaryState, TeacherSummary } from '@/types/reviews';

const SUMMARY: TeacherSummary = {
  courseTeacherId: '11111111-1111-1111-1111-111111111111',
  courseCode: 'CS2023',
  teacherEmail: 'bojeda@utec.edu.pe',
  teacherName: 'Ojeda Rios, Brenner Humberto',
  averageRating: 4.3,
  ratingCount: 7,
  commentCount: 2,
  recommendPercentage: 86,
};

describe('readNumber', () => {
  it('acepta las dos formas en que el driver devuelve un número', () => {
    expect(readNumber(4.3)).toBe(4.3);
    expect(readNumber('4.3')).toBe(4.3);
    expect(readNumber(' 12 ')).toBe(12);
  });

  it('descarta lo que no es un número finito', () => {
    expect(readNumber(null)).toBeNull();
    expect(readNumber(undefined)).toBeNull();
    expect(readNumber('')).toBeNull();
    expect(readNumber('   ')).toBeNull();
    expect(readNumber('sin datos')).toBeNull();
    expect(readNumber(Number.NaN)).toBeNull();
    expect(readNumber(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('formatAverageRating', () => {
  it('muestra siempre un decimal (FR-003)', () => {
    expect(formatAverageRating(4)).toBe('4.0');
    expect(formatAverageRating(4.3)).toBe('4.3');
    expect(formatAverageRating(5)).toBe('5.0');
    expect(formatAverageRating(1)).toBe('1.0');
  });

  it('formatea igual el promedio que llega como string', () => {
    expect(formatAverageRating('4.3')).toBe('4.3');
    expect(formatAverageRating('5')).toBe('5.0');
  });

  it('recorta a un decimal si la vista no redondeó', () => {
    expect(formatAverageRating(4.25)).toBe('4.3');
    expect(formatAverageRating('3.666666')).toBe('3.7');
  });

  it('no inventa un promedio cuando no hay número', () => {
    expect(formatAverageRating(null)).toBeNull();
    expect(formatAverageRating(undefined)).toBeNull();
    expect(formatAverageRating('')).toBeNull();
  });
});

describe('formatRecommendPercentage', () => {
  it('es entero y sin decimales (FR-059)', () => {
    expect(formatRecommendPercentage(86)).toBe('86%');
    expect(formatRecommendPercentage(86.4)).toBe('86%');
    expect(formatRecommendPercentage('85.5')).toBe('86%');
  });

  it('muestra los extremos, que son los de una sola reseña', () => {
    expect(formatRecommendPercentage(0)).toBe('0%');
    expect(formatRecommendPercentage(100)).toBe('100%');
  });

  it('no inventa un porcentaje cuando no hay número', () => {
    expect(formatRecommendPercentage(null)).toBeNull();
    expect(formatRecommendPercentage(undefined)).toBeNull();
  });
});

describe('ratingFillPercentage', () => {
  it('reparte la escala completa entre las cinco estrellas', () => {
    expect(RATING_SCALE_MAX).toBe(5);
    expect(ratingFillPercentage(5)).toBe(100);
    expect(ratingFillPercentage(4.3)).toBe(86);
    expect(ratingFillPercentage(1)).toBe(20);
    expect(ratingFillPercentage('2.5')).toBe(50);
  });

  it('siempre devuelve un ancho pintable', () => {
    expect(ratingFillPercentage(null)).toBe(0);
    expect(ratingFillPercentage('no es número')).toBe(0);
    expect(ratingFillPercentage(-1)).toBe(0);
    expect(ratingFillPercentage(9)).toBe(100);
  });
});

describe('formatStarOptionLabel', () => {
  it('usa el singular en la primera estrella', () => {
    expect(formatStarOptionLabel(1)).toBe('1 estrella');
  });

  it.each([2, 3, 4, 5])('usa el plural en %i', (value) => {
    expect(formatStarOptionLabel(value)).toBe(`${value} estrellas`);
  });
});

describe('formatRatingCount', () => {
  it('usa el singular con una sola puntuación', () => {
    expect(formatRatingCount(1)).toBe('1 puntuación');
    expect(formatRatingCount('1')).toBe('1 puntuación');
  });

  it('usa el plural con cualquier otra cantidad', () => {
    expect(formatRatingCount(0)).toBe('0 puntuaciones');
    expect(formatRatingCount(2)).toBe('2 puntuaciones');
    expect(formatRatingCount(7)).toBe('7 puntuaciones');
    expect(formatRatingCount('13')).toBe('13 puntuaciones');
  });

  it('cae en cero cuando no hay número', () => {
    expect(formatRatingCount(null)).toBe('0 puntuaciones');
    expect(formatRatingCount(undefined)).toBe('0 puntuaciones');
  });
});

describe('formatCommentCount', () => {
  it('usa el singular con un solo comentario', () => {
    expect(formatCommentCount(1)).toBe('1 comentario');
    expect(formatCommentCount('1')).toBe('1 comentario');
  });

  it('usa el plural con más de uno', () => {
    expect(formatCommentCount(2)).toBe('2 comentarios');
    expect(formatCommentCount('9')).toBe('9 comentarios');
  });

  it('sin comentarios muestra el estado vacío y no un cero', () => {
    expect(formatCommentCount(0)).toBe('Aún no hay comentarios');
    expect(formatCommentCount(0)).toBe(NO_COMMENTS_LABEL);
    expect(formatCommentCount(0)).not.toContain('0');
    expect(formatCommentCount(null)).toBe(NO_COMMENTS_LABEL);
  });
});

describe('formatEditedMark', () => {
  it('marca el comentario que cambió después de publicarse (FR-055)', () => {
    expect(formatEditedMark('2026-07-29T20:45:00Z')).toBe('editado');
    expect(formatEditedMark(new Date('2026-07-29T20:45:00Z'))).toBe('editado');
  });

  it('no marca nada si el comentario no se editó', () => {
    expect(formatEditedMark(null)).toBeNull();
    expect(formatEditedMark(undefined)).toBeNull();
  });
});

describe('etiquetas de los estados', () => {
  it('separa al docente sin evaluar del que no existe', () => {
    expect(EMPTY_SUMMARY_LABEL).toBe('Sin puntuaciones');
    expect(UNASSIGNED_TEACHER_LABEL).toBe('Docente por asignar');
    expect(EMPTY_SUMMARY_LABEL).not.toBe(UNASSIGNED_TEACHER_LABEL);
  });

  it('no confunde ninguno de los dos con un fallo de carga (SC-002)', () => {
    const labels = [EMPTY_SUMMARY_LABEL, UNASSIGNED_TEACHER_LABEL, ERROR_SUMMARY_LABEL];
    expect(new Set(labels).size).toBe(3);
  });
});

describe('formatSummaryAriaLabel', () => {
  const NAME = 'Ojeda Rios, Brenner Humberto';

  // El conteo de comentarios queda fuera mientras `COMMENTS_ENABLED` sea falso:
  // el texto equivalente dice exactamente lo que hay en pantalla, ni más.
  it('dice el resumen completo, que en pantalla está partido en fragmentos', () => {
    expect(formatSummaryAriaLabel(NAME, { kind: 'summary', summary: SUMMARY })).toBe(
      `${NAME}: 4.3 de 5 estrellas, 7 puntuaciones, 86% ${RECOMMEND_LABEL}.`
    );
  });

  it('usa el singular también acá', () => {
    const single: TeacherSummary = {
      ...SUMMARY,
      averageRating: 5,
      ratingCount: 1,
      commentCount: 0,
      recommendPercentage: 100,
    };

    expect(formatSummaryAriaLabel(NAME, { kind: 'summary', summary: single })).toBe(
      `${NAME}: 5.0 de 5 estrellas, 1 puntuación, 100% ${RECOMMEND_LABEL}.`
    );
  });

  it('distingue los tres motivos por los que no hay promedio (SC-002)', () => {
    const empty = formatSummaryAriaLabel(NAME, { kind: 'empty' });
    const unassigned = formatSummaryAriaLabel(NAME, { kind: 'unassigned' });
    const error = formatSummaryAriaLabel(NAME, { kind: 'error' });
    const loading = formatSummaryAriaLabel(NAME, { kind: 'loading' });

    expect(empty).toBe(`${NAME}: Sin puntuaciones.`);
    expect(unassigned).toBe('Docente por asignar.');
    expect(empty).not.toContain(UNASSIGNED_TEACHER_LABEL);
    expect(unassigned).not.toContain(EMPTY_SUMMARY_LABEL);
    expect(new Set([empty, unassigned, error, loading]).size).toBe(4);
  });

  it('no nombra a nadie cuando no hay docente asignado', () => {
    expect(formatSummaryAriaLabel(NAME, { kind: 'unassigned' })).not.toContain(NAME);
  });

  it('no deja dos puntos sueltos si el nombre viene vacío', () => {
    expect(formatSummaryAriaLabel('', { kind: 'empty' })).toBe('Sin puntuaciones.');
    expect(formatSummaryAriaLabel('   ', { kind: 'error' })).toBe(`${ERROR_SUMMARY_LABEL}.`);
  });

  it('cubre todos los estados', () => {
    const states: SummaryState[] = [
      { kind: 'summary', summary: SUMMARY },
      { kind: 'empty' },
      { kind: 'unassigned' },
      { kind: 'loading' },
      { kind: 'error' },
    ];

    for (const state of states) {
      expect(formatSummaryAriaLabel(NAME, state)).toMatch(/\.$/);
    }
  });
});

describe('formatRatingLimitMessage', () => {
  // 15:45 en Lima (UTC-5).
  const RELEASE_AT = '2026-07-29T20:45:00Z';

  it('dice cuándo se puede volver a contribuir (FR-031)', () => {
    expect(formatRatingLimitMessage(RELEASE_AT, 'America/Lima')).toBe(
      'Alcanzaste el límite de 8 puntuaciones en 24 horas. ' +
        'Podrás volver a publicar el 29 de julio a las 15:45.'
    );
  });

  it('usa la hora local de quien mira, no el instante crudo', () => {
    expect(formatRatingLimitMessage(RELEASE_AT, 'UTC')).toContain('a las 20:45');
    expect(formatRatingLimitMessage(RELEASE_AT, 'America/Lima')).toContain('a las 15:45');
    expect(formatRatingLimitMessage(RELEASE_AT, 'UTC')).not.toContain('2026-07-29T20:45:00Z');
  });

  it('acepta un Date y un epoch además del ISO', () => {
    const expected = formatRatingLimitMessage(RELEASE_AT, 'America/Lima');
    expect(formatRatingLimitMessage(new Date(RELEASE_AT), 'America/Lima')).toBe(expected);
    expect(formatRatingLimitMessage(Date.parse(RELEASE_AT), 'America/Lima')).toBe(expected);
  });

  it('nombra el límite de FR-030 en plural', () => {
    expect(DAILY_RATING_LIMIT).toBe(8);
    expect(formatRatingLimitMessage(RELEASE_AT, 'America/Lima')).toContain('8 puntuaciones');
  });

  it('sigue explicando el bloqueo si el instante no se puede leer', () => {
    const message = formatRatingLimitMessage('sin fecha');
    expect(message).toContain('Alcanzaste el límite de 8 puntuaciones en 24 horas.');
    expect(message).toContain('más tarde');
    expect(message).not.toContain('Invalid Date');
  });
});

describe('formatCommentDate', () => {
  const LIMA = 'America/Lima';

  it('muestra día, mes y año', () => {
    expect(formatCommentDate('2026-05-12T15:04:05Z', LIMA)).toBe('12 de mayo de 2026');
  });

  // La lista mezcla ciclos: sin año, «12 de mayo» no dice de cuál.
  it('distingue el mismo día de dos años', () => {
    expect(formatCommentDate('2025-05-12T15:04:05Z', LIMA)).not.toBe(
      formatCommentDate('2026-05-12T15:04:05Z', LIMA)
    );
  });

  // El minuto exacto no le sirve a quien lee y sí ayuda a correlacionar.
  it('no incluye la hora', () => {
    expect(formatCommentDate('2026-05-12T15:04:05Z', LIMA)).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it('acepta Date además de texto', () => {
    expect(formatCommentDate(new Date('2026-05-12T15:04:05Z'), LIMA)).toBe('12 de mayo de 2026');
  });

  it.each([[null], [undefined], ['sin fecha'], ['']])('devuelve null para %o', (value) => {
    expect(formatCommentDate(value, LIMA)).toBeNull();
  });
});
