import { describe, it, expect } from 'vitest';
import {
  computeFreeBlocks,
  sumFreeBlockMinutes,
  formatDuration,
  MIN_FREE_BLOCK_MINUTES,
} from '@/lib/schedule-utils';
import type { CalendarEvent, Session } from '@/types';

/**
 * Bloques libres entre clases (specs/001-bloques libres-horario/spec.md).
 *
 * computeFreeBlocks es la única lógica no trivial de la feature: fusiona los tramos
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

/** Representación compacta de un bloque libre, para comparar sin ruido. */
function resumen(freeBlocks: ReturnType<typeof computeFreeBlocks>): string[] {
  return freeBlocks.map(g => `${g.day} ${g.startMinutes}-${g.endMinutes} (${formatDuration(g.durationMinutes)})`);
}

describe('computeFreeBlocks — acceptance scenarios', () => {
  it('AS1: entre 07:00-09:00 y 17:00-19:00 detecta un bloque libre de 8 h', () => {
    const freeBlocks = computeFreeBlocks([clase('Lun', '07:00', '09:00'), clase('Lun', '17:00', '19:00')]);
    expect(freeBlocks).toEqual([
      { day: 'Lun', startMinutes: 540, endMinutes: 1020, durationMinutes: 480 },
    ]);
  });

  it('AS2: el umbral es inclusivo, un bloque libre de exactamente 2 h se muestra', () => {
    const freeBlocks = computeFreeBlocks([clase('Mar', '07:00', '09:00'), clase('Mar', '11:00', '13:00')]);
    expect(resumen(freeBlocks)).toEqual(['Mar 540-660 (2 h)']);
  });

  it('AS3: un bloque libre de 1 h no llega al umbral y no se reporta', () => {
    const freeBlocks = computeFreeBlocks([clase('Mie', '14:00', '16:00'), clase('Mie', '17:00', '19:00')]);
    expect(freeBlocks).toEqual([]);
  });

  it('AS4: un bloque libre de 2 h 30 min conserva los minutos', () => {
    const freeBlocks = computeFreeBlocks([clase('Jue', '08:00', '09:00'), clase('Jue', '11:30', '13:00')]);
    expect(resumen(freeBlocks)).toEqual(['Jue 540-690 (2 h 30 min)']);
  });

  it('AS5: un día con una sola clase no tiene bloques libres', () => {
    expect(computeFreeBlocks([clase('Vie', '09:00', '11:00')])).toEqual([]);
  });

  it('AS6: un día sin clases no tiene bloques libres', () => {
    expect(computeFreeBlocks([])).toEqual([]);
  });

  it('AS7: dos clases solapadas cuentan como un solo tramo ocupado', () => {
    const freeBlocks = computeFreeBlocks([
      clase('Lun', '09:00', '11:00'),
      clase('Lun', '10:00', '13:00'),
      clase('Lun', '16:00', '18:00'),
    ]);
    expect(resumen(freeBlocks)).toEqual(['Lun 780-960 (3 h)']);
  });

  it('AS10: el total semanal suma los bloques libres de todos los días', () => {
    const freeBlocks = computeFreeBlocks([
      clase('Mie', '08:00', '09:00'), clase('Mie', '12:00', '13:00'), // 3 h
      clase('Vie', '08:00', '09:00'), clase('Vie', '14:00', '15:00'), // 5 h
    ]);
    expect(formatDuration(sumFreeBlockMinutes(freeBlocks))).toBe('8 h');
  });

  it('AS11: sin bloques libres que alcancen el umbral el total es 0 h', () => {
    const freeBlocks = computeFreeBlocks([clase('Lun', '09:00', '11:00'), clase('Lun', '12:00', '13:00')]);
    expect(freeBlocks).toEqual([]);
    expect(formatDuration(sumFreeBlockMinutes(freeBlocks))).toBe('0 h');
  });
});

describe('computeFreeBlocks — umbral', () => {
  it('el umbral por defecto es 120 minutos', () => {
    expect(MIN_FREE_BLOCK_MINUTES).toBe(120);
  });

  it('un bloque libre de 119 min queda por debajo del umbral', () => {
    const freeBlocks = computeFreeBlocks([clase('Lun', '08:00', '09:00'), clase('Lun', '10:59', '12:00')]);
    expect(freeBlocks).toEqual([]);
  });

  it('un bloque libre de 120 min alcanza el umbral', () => {
    const freeBlocks = computeFreeBlocks([clase('Lun', '08:00', '09:00'), clase('Lun', '11:00', '12:00')]);
    expect(freeBlocks).toHaveLength(1);
    expect(freeBlocks[0].durationMinutes).toBe(120);
  });

  it('acepta un umbral distinto por parámetro', () => {
    const eventos = [clase('Lun', '14:00', '16:00'), clase('Lun', '17:00', '19:00')];
    expect(computeFreeBlocks(eventos)).toEqual([]);
    expect(computeFreeBlocks(eventos, 60)).toHaveLength(1);
  });
});

describe('computeFreeBlocks — fusión de tramos ocupados', () => {
  it('dos clases contiguas no generan bloque libre', () => {
    const freeBlocks = computeFreeBlocks([clase('Lun', '07:00', '09:00'), clase('Lun', '09:00', '11:00')]);
    expect(freeBlocks).toEqual([]);
  });

  it('varias clases contiguas se fusionan y el bloque libre se mide desde el final del bloque', () => {
    const freeBlocks = computeFreeBlocks([
      clase('Lun', '07:00', '09:00'),
      clase('Lun', '09:00', '11:00'),
      clase('Lun', '15:00', '17:00'),
    ]);
    expect(resumen(freeBlocks)).toEqual(['Lun 660-900 (4 h)']);
  });

  it('un solapamiento parcial no inventa un bloque libre dentro del tramo ocupado', () => {
    const freeBlocks = computeFreeBlocks([clase('Lun', '08:00', '12:00'), clase('Lun', '11:00', '13:00')]);
    expect(freeBlocks).toEqual([]);
  });

  it('una clase contenida dentro de otra no genera bloque libre', () => {
    const freeBlocks = computeFreeBlocks([clase('Lun', '08:00', '13:00'), clase('Lun', '09:00', '10:00')]);
    expect(freeBlocks).toEqual([]);
  });

  it('dos clases idénticas se fusionan en un solo tramo', () => {
    const freeBlocks = computeFreeBlocks([
      clase('Lun', '08:00', '10:00'),
      clase('Lun', '08:00', '10:00'),
      clase('Lun', '13:00', '14:00'),
    ]);
    expect(resumen(freeBlocks)).toEqual(['Lun 600-780 (3 h)']);
  });

  it('el orden de entrada no cambia el resultado', () => {
    const desordenado = computeFreeBlocks([
      clase('Lun', '16:00', '18:00'),
      clase('Lun', '09:00', '11:00'),
      clase('Lun', '10:00', '13:00'),
    ]);
    const ordenado = computeFreeBlocks([
      clase('Lun', '09:00', '11:00'),
      clase('Lun', '10:00', '13:00'),
      clase('Lun', '16:00', '18:00'),
    ]);
    expect(desordenado).toEqual(ordenado);
  });
});

describe('computeFreeBlocks — alcance del cálculo', () => {
  it('ignora el tiempo antes de la primera clase y después de la última', () => {
    // El día va de 07:00 a 22:00: sin este recorte saldrían bloques libres en los bordes.
    const freeBlocks = computeFreeBlocks([clase('Lun', '13:00', '14:00'), clase('Lun', '17:00', '18:00')]);
    expect(resumen(freeBlocks)).toEqual(['Lun 840-1020 (3 h)']);
  });

  it('detecta varios bloques libres dentro del mismo día, en orden', () => {
    const freeBlocks = computeFreeBlocks([
      clase('Lun', '07:00', '08:00'),
      clase('Lun', '10:00', '11:00'),
      clase('Lun', '14:00', '15:00'),
    ]);
    expect(resumen(freeBlocks)).toEqual(['Lun 480-600 (2 h)', 'Lun 660-840 (3 h)']);
  });

  it('trata cada día por separado, sábado incluido', () => {
    const freeBlocks = computeFreeBlocks([
      clase('Lun', '08:00', '09:00'), clase('Lun', '12:00', '13:00'),
      clase('Sab', '08:00', '09:00'), clase('Sab', '17:00', '18:00'),
    ]);
    expect(resumen(freeBlocks)).toEqual(['Lun 540-720 (3 h)', 'Sab 540-1020 (8 h)']);
  });

  it('no cruza días: el final de un día no forma bloque libre con el inicio del siguiente', () => {
    const freeBlocks = computeFreeBlocks([clase('Lun', '08:00', '09:00'), clase('Mar', '17:00', '18:00')]);
    expect(freeBlocks).toEqual([]);
  });

  it('FR-005: los eventos de preview no entran en el cálculo', () => {
    const seleccionados = [clase('Lun', '08:00', '09:00'), clase('Lun', '14:00', '15:00')];
    const conPreview = [...seleccionados, clase('Lun', '11:00', '12:00', { isPreview: true })];
    // La preview cae dentro del bloque libre: si contara, lo partiría en dos tramos cortos.
    expect(computeFreeBlocks(conPreview)).toEqual(computeFreeBlocks(seleccionados));
    expect(resumen(computeFreeBlocks(conPreview))).toEqual(['Lun 540-840 (5 h)']);
  });

  it('no muta el arreglo de eventos que recibe', () => {
    const eventos = [clase('Lun', '16:00', '18:00'), clase('Lun', '09:00', '11:00')];
    const copia = [...eventos];
    computeFreeBlocks(eventos);
    expect(eventos).toEqual(copia);
  });
});

describe('sumFreeBlockMinutes', () => {
  it('sin bloques libres suma 0', () => {
    expect(sumFreeBlockMinutes([])).toBe(0);
  });

  it('suma los minutos reales, no las horas redondeadas', () => {
    const freeBlocks = computeFreeBlocks([
      clase('Lun', '08:00', '09:00'), clase('Lun', '11:30', '12:00'), // 2 h 30 min
      clase('Mar', '08:00', '09:00'), clase('Mar', '11:45', '12:00'), // 2 h 45 min
    ]);
    expect(sumFreeBlockMinutes(freeBlocks)).toBe(315);
    expect(formatDuration(sumFreeBlockMinutes(freeBlocks))).toBe('5 h 15 min');
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
