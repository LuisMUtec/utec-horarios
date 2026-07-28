import { describe, it, expect } from 'vitest';
import {
  computeGaps,
  sumGapMinutes,
  formatDuration,
  MIN_GAP_MINUTES,
} from '@/lib/schedule-utils';
import type { CalendarEvent, Session } from '@/types';

/**
 * Huecos entre clases (specs/001-huecos-horario/spec.md).
 *
 * computeGaps es la única lógica no trivial de la feature: fusiona los tramos
 * ocupados de cada día y deriva los libres. Los casos numerados corresponden a
 * los acceptance scenarios del spec.
 */

function clase(day: string, startTime: string, endTime: string, extra: Partial<CalendarEvent> = {}): CalendarEvent {
  const session = { day, startTime, endTime } as Session;
  return {
    courseCode: 'CS0000',
    courseName: 'Curso',
    color: '',
    session,
    ...extra,
  };
}

/** Representación compacta de un hueco, para comparar sin ruido. */
function resumen(gaps: ReturnType<typeof computeGaps>): string[] {
  return gaps.map(g => `${g.day} ${g.startMinutes}-${g.endMinutes} (${formatDuration(g.durationMinutes)})`);
}

describe('computeGaps — acceptance scenarios', () => {
  it('AS1: entre 07:00-09:00 y 17:00-19:00 detecta un hueco de 8 h', () => {
    const gaps = computeGaps([clase('Lun', '07:00', '09:00'), clase('Lun', '17:00', '19:00')]);
    expect(gaps).toEqual([
      { day: 'Lun', startMinutes: 540, endMinutes: 1020, durationMinutes: 480 },
    ]);
  });

  it('AS2: el umbral es inclusivo, un hueco de exactamente 2 h se muestra', () => {
    const gaps = computeGaps([clase('Mar', '07:00', '09:00'), clase('Mar', '11:00', '13:00')]);
    expect(resumen(gaps)).toEqual(['Mar 540-660 (2 h)']);
  });

  it('AS3: un hueco de 1 h no llega al umbral y no se reporta', () => {
    const gaps = computeGaps([clase('Mie', '14:00', '16:00'), clase('Mie', '17:00', '19:00')]);
    expect(gaps).toEqual([]);
  });

  it('AS4: un hueco de 2 h 30 min conserva los minutos', () => {
    const gaps = computeGaps([clase('Jue', '08:00', '09:00'), clase('Jue', '11:30', '13:00')]);
    expect(resumen(gaps)).toEqual(['Jue 540-690 (2 h 30 min)']);
  });

  it('AS5: un día con una sola clase no tiene huecos', () => {
    expect(computeGaps([clase('Vie', '09:00', '11:00')])).toEqual([]);
  });

  it('AS6: un día sin clases no tiene huecos', () => {
    expect(computeGaps([])).toEqual([]);
  });

  it('AS7: dos clases solapadas cuentan como un solo tramo ocupado', () => {
    const gaps = computeGaps([
      clase('Lun', '09:00', '11:00'),
      clase('Lun', '10:00', '13:00'),
      clase('Lun', '16:00', '18:00'),
    ]);
    expect(resumen(gaps)).toEqual(['Lun 780-960 (3 h)']);
  });

  it('AS10: el total semanal suma los huecos de todos los días', () => {
    const gaps = computeGaps([
      clase('Mie', '08:00', '09:00'), clase('Mie', '12:00', '13:00'), // 3 h
      clase('Vie', '08:00', '09:00'), clase('Vie', '14:00', '15:00'), // 5 h
    ]);
    expect(formatDuration(sumGapMinutes(gaps))).toBe('8 h');
  });

  it('AS11: sin huecos que alcancen el umbral el total es 0 h', () => {
    const gaps = computeGaps([clase('Lun', '09:00', '11:00'), clase('Lun', '12:00', '13:00')]);
    expect(gaps).toEqual([]);
    expect(formatDuration(sumGapMinutes(gaps))).toBe('0 h');
  });
});

describe('computeGaps — umbral', () => {
  it('el umbral por defecto es 120 minutos', () => {
    expect(MIN_GAP_MINUTES).toBe(120);
  });

  it('un hueco de 119 min queda por debajo del umbral', () => {
    const gaps = computeGaps([clase('Lun', '08:00', '09:00'), clase('Lun', '10:59', '12:00')]);
    expect(gaps).toEqual([]);
  });

  it('un hueco de 120 min alcanza el umbral', () => {
    const gaps = computeGaps([clase('Lun', '08:00', '09:00'), clase('Lun', '11:00', '12:00')]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].durationMinutes).toBe(120);
  });

  it('acepta un umbral distinto por parámetro', () => {
    const eventos = [clase('Lun', '14:00', '16:00'), clase('Lun', '17:00', '19:00')];
    expect(computeGaps(eventos)).toEqual([]);
    expect(computeGaps(eventos, 60)).toHaveLength(1);
  });
});

describe('computeGaps — fusión de tramos ocupados', () => {
  it('dos clases contiguas no generan hueco', () => {
    const gaps = computeGaps([clase('Lun', '07:00', '09:00'), clase('Lun', '09:00', '11:00')]);
    expect(gaps).toEqual([]);
  });

  it('varias clases contiguas se fusionan y el hueco se mide desde el final del bloque', () => {
    const gaps = computeGaps([
      clase('Lun', '07:00', '09:00'),
      clase('Lun', '09:00', '11:00'),
      clase('Lun', '15:00', '17:00'),
    ]);
    expect(resumen(gaps)).toEqual(['Lun 660-900 (4 h)']);
  });

  it('un solapamiento parcial no inventa un hueco dentro del tramo ocupado', () => {
    const gaps = computeGaps([clase('Lun', '08:00', '12:00'), clase('Lun', '11:00', '13:00')]);
    expect(gaps).toEqual([]);
  });

  it('una clase contenida dentro de otra no genera hueco', () => {
    const gaps = computeGaps([clase('Lun', '08:00', '13:00'), clase('Lun', '09:00', '10:00')]);
    expect(gaps).toEqual([]);
  });

  it('dos clases idénticas se fusionan en un solo tramo', () => {
    const gaps = computeGaps([
      clase('Lun', '08:00', '10:00'),
      clase('Lun', '08:00', '10:00'),
      clase('Lun', '13:00', '14:00'),
    ]);
    expect(resumen(gaps)).toEqual(['Lun 600-780 (3 h)']);
  });

  it('el orden de entrada no cambia el resultado', () => {
    const desordenado = computeGaps([
      clase('Lun', '16:00', '18:00'),
      clase('Lun', '09:00', '11:00'),
      clase('Lun', '10:00', '13:00'),
    ]);
    const ordenado = computeGaps([
      clase('Lun', '09:00', '11:00'),
      clase('Lun', '10:00', '13:00'),
      clase('Lun', '16:00', '18:00'),
    ]);
    expect(desordenado).toEqual(ordenado);
  });
});

describe('computeGaps — alcance del cálculo', () => {
  it('ignora el tiempo antes de la primera clase y después de la última', () => {
    // El día va de 07:00 a 22:00: sin este recorte saldrían huecos en los bordes.
    const gaps = computeGaps([clase('Lun', '13:00', '14:00'), clase('Lun', '17:00', '18:00')]);
    expect(resumen(gaps)).toEqual(['Lun 840-1020 (3 h)']);
  });

  it('detecta varios huecos dentro del mismo día, en orden', () => {
    const gaps = computeGaps([
      clase('Lun', '07:00', '08:00'),
      clase('Lun', '10:00', '11:00'),
      clase('Lun', '14:00', '15:00'),
    ]);
    expect(resumen(gaps)).toEqual(['Lun 480-600 (2 h)', 'Lun 660-840 (3 h)']);
  });

  it('trata cada día por separado, sábado incluido', () => {
    const gaps = computeGaps([
      clase('Lun', '08:00', '09:00'), clase('Lun', '12:00', '13:00'),
      clase('Sab', '08:00', '09:00'), clase('Sab', '17:00', '18:00'),
    ]);
    expect(resumen(gaps)).toEqual(['Lun 540-720 (3 h)', 'Sab 540-1020 (8 h)']);
  });

  it('no cruza días: el final de un día no forma hueco con el inicio del siguiente', () => {
    const gaps = computeGaps([clase('Lun', '08:00', '09:00'), clase('Mar', '17:00', '18:00')]);
    expect(gaps).toEqual([]);
  });

  it('FR-005: los eventos de preview no entran en el cálculo', () => {
    const seleccionados = [clase('Lun', '08:00', '09:00'), clase('Lun', '14:00', '15:00')];
    const conPreview = [...seleccionados, clase('Lun', '11:00', '12:00', { isPreview: true })];
    // La preview cae dentro del hueco: si contara, lo partiría en dos tramos cortos.
    expect(computeGaps(conPreview)).toEqual(computeGaps(seleccionados));
    expect(resumen(computeGaps(conPreview))).toEqual(['Lun 540-840 (5 h)']);
  });

  it('no muta el arreglo de eventos que recibe', () => {
    const eventos = [clase('Lun', '16:00', '18:00'), clase('Lun', '09:00', '11:00')];
    const copia = [...eventos];
    computeGaps(eventos);
    expect(eventos).toEqual(copia);
  });
});

describe('sumGapMinutes', () => {
  it('sin huecos suma 0', () => {
    expect(sumGapMinutes([])).toBe(0);
  });

  it('suma los minutos reales, no las horas redondeadas', () => {
    const gaps = computeGaps([
      clase('Lun', '08:00', '09:00'), clase('Lun', '11:30', '12:00'), // 2 h 30 min
      clase('Mar', '08:00', '09:00'), clase('Mar', '11:45', '12:00'), // 2 h 45 min
    ]);
    expect(sumGapMinutes(gaps)).toBe(315);
    expect(formatDuration(sumGapMinutes(gaps))).toBe('5 h 15 min');
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0 h'],
    [120, '2 h'],
    [180, '3 h'],
    [480, '8 h'],
    [150, '2 h 30 min'],
    [125, '2 h 5 min'],
    [45, '45 min'],
    [1, '1 min'],
  ])('formatea %i minutos como "%s"', (minutos, esperado) => {
    expect(formatDuration(minutos)).toBe(esperado);
  });
});
