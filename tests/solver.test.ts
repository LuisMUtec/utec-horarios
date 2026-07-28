import { describe, it, expect } from 'vitest';
import { buildCourseOptions, solveSchedule } from '@/lib/solver';
import coursesData from '@/data/courses.json';
import type { Course, Section, Session } from '@/types';

/**
 * Armado automático de horarios (src/lib/solver.ts).
 *
 * Los casos sintéticos fijan las reglas una por una; el último compara el
 * solver contra una enumeración ingenua sobre la oferta real, que es lo único
 * que demuestra que las podas no se comen el óptimo.
 */

function sesion(
  day: string,
  startTime: string,
  endTime: string,
  extra: Partial<Session> = {}
): Session {
  return {
    type: 'TEORÍA 1',
    modality: 'Presencial',
    day,
    startTime,
    endTime,
    frequency: 'Semana General',
    location: 'UTEC-BA A101',
    capacity: 30,
    enrolled: 0,
    professor: 'Docente, Alguien',
    email: 'docente@utec.edu.pe',
    ...extra,
  };
}

function curso(code: string, sections: Section[]): Course {
  return { code, name: `Curso ${code}`, sections };
}

/** Códigos elegidos de cada candidato, en formato compacto. */
function combo(selection: { courseCode: string; sectionNumber: number; subsessionId?: string }[]): string[] {
  return selection
    .map(s => `${s.courseCode}-${s.sectionNumber}${s.subsessionId ? `/${s.subsessionId}` : ''}`)
    .sort();
}

describe('buildCourseOptions', () => {
  it('sin subsesiones genera una opción por sección', () => {
    const c = curso('CS0001', [
      { number: 1, sessions: [sesion('Lun', '09:00', '11:00')] },
      { number: 2, sessions: [sesion('Mar', '09:00', '11:00')] },
    ]);
    const options = buildCourseOptions(c);
    expect(options).toHaveLength(2);
    expect(options.map(o => o.sectionNumber)).toEqual([1, 2]);
    expect(options.every(o => o.subsessionId === undefined)).toBe(true);
  });

  it('con subsesiones genera una opción por grupo, arrastrando las obligatorias', () => {
    const c = curso('CS0002', [
      {
        number: 1,
        sessions: [
          sesion('Lun', '09:00', '11:00', { type: 'TEORÍA 1', capacity: 60 }),
          sesion('Mar', '14:00', '16:00', { type: 'LABORATORIO 11', capacity: 30 }),
          sesion('Mie', '14:00', '16:00', { type: 'LABORATORIO 12', capacity: 30 }),
        ],
      },
    ]);
    const options = buildCourseOptions(c);
    expect(options).toHaveLength(2);
    expect(options.map(o => o.subsessionId).sort()).toEqual(['LABORATORIO-11', 'LABORATORIO-12']);
    // Cada opción incluye la teoría obligatoria además de su laboratorio.
    for (const option of options) {
      expect(option.sessions).toHaveLength(2);
      expect(option.sessions.some(s => s.type === 'TEORÍA 1')).toBe(true);
    }
  });

  it('marca las horas de Semana General en ambos planos y las de A/B sólo en el suyo', () => {
    const c = curso('CS0003', [
      {
        number: 1,
        sessions: [
          sesion('Lun', '07:00', '08:00'),
          sesion('Mar', '07:00', '08:00', { frequency: 'Semana A' }),
          sesion('Mie', '07:00', '08:00', { frequency: 'Semana B' }),
        ],
      },
    ]);
    const [option] = buildCourseOptions(c);
    // Lun=0, Mar=1, Mie=2. La hora 07:00 es el bit 0.
    expect(option.weekA).toEqual([1, 1, 0, 0, 0, 0]);
    expect(option.weekB).toEqual([1, 0, 1, 0, 0, 0]);
  });
});

describe('solveSchedule — cruces', () => {
  it('descarta las combinaciones con cruce y devuelve la única viable', () => {
    const courses = [
      curso('AA', [
        { number: 1, sessions: [sesion('Lun', '09:00', '11:00')] },
        { number: 2, sessions: [sesion('Mar', '09:00', '11:00')] },
      ]),
      curso('BB', [{ number: 1, sessions: [sesion('Lun', '09:00', '11:00')] }]),
    ];
    const result = solveSchedule(courses, ['AA', 'BB']);
    expect(result.evaluatedCount).toBe(1);
    expect(combo(result.candidates[0].selection)).toEqual(['AA-2', 'BB-1']);
  });

  it('Semana A y Semana B en el mismo slot no se cruzan', () => {
    const courses = [
      curso('AA', [{ number: 1, sessions: [sesion('Lun', '09:00', '11:00', { frequency: 'Semana A' })] }]),
      curso('BB', [{ number: 1, sessions: [sesion('Lun', '09:00', '11:00', { frequency: 'Semana B' })] }]),
    ];
    expect(solveSchedule(courses, ['AA', 'BB']).evaluatedCount).toBe(1);
  });

  it('Semana General se cruza tanto con Semana A como con Semana B', () => {
    const general = curso('AA', [{ number: 1, sessions: [sesion('Lun', '09:00', '11:00')] }]);
    for (const frequency of ['Semana A', 'Semana B']) {
      const otro = curso('BB', [{ number: 1, sessions: [sesion('Lun', '09:00', '11:00', { frequency })] }]);
      expect(solveSchedule([general, otro], ['AA', 'BB']).evaluatedCount).toBe(0);
    }
  });

  it('dos clases contiguas no se cruzan (la que termina a las 11 y la que empieza a las 11)', () => {
    const courses = [
      curso('AA', [{ number: 1, sessions: [sesion('Lun', '09:00', '11:00')] }]),
      curso('BB', [{ number: 1, sessions: [sesion('Lun', '11:00', '13:00')] }]),
    ];
    expect(solveSchedule(courses, ['AA', 'BB']).evaluatedCount).toBe(1);
  });
});

describe('solveSchedule — horas muertas', () => {
  it('prefiere la sección que no deja hueco', () => {
    const courses = [
      curso('AA', [{ number: 1, sessions: [sesion('Lun', '09:00', '11:00')] }]),
      curso('BB', [
        { number: 1, sessions: [sesion('Lun', '15:00', '17:00')] }, // 4 h de hueco
        { number: 2, sessions: [sesion('Lun', '11:00', '13:00')] }, // sin hueco
      ]),
    ];
    const result = solveSchedule(courses, ['AA', 'BB']);
    expect(result.candidates[0].deadMinutes).toBe(0);
    expect(combo(result.candidates[0].selection)).toEqual(['AA-1', 'BB-2']);
    expect(result.candidates[1].deadMinutes).toBe(240);
  });

  it('no cuenta como hueco el tiempo antes de la primera clase ni después de la última', () => {
    const courses = [curso('AA', [{ number: 1, sessions: [sesion('Lun', '15:00', '17:00')] }])];
    expect(solveSchedule(courses, ['AA']).candidates[0].deadMinutes).toBe(0);
  });

  it('cuenta también los huecos de menos de 2 h, a diferencia de computeFreeBlocks', () => {
    const courses = [
      curso('AA', [{ number: 1, sessions: [sesion('Lun', '09:00', '11:00')] }]),
      curso('BB', [{ number: 1, sessions: [sesion('Lun', '12:00', '14:00')] }]),
    ];
    expect(solveSchedule(courses, ['AA', 'BB']).candidates[0].deadMinutes).toBe(60);
  });

  it('promedia las horas muertas de la semana A y la semana B', () => {
    // Lunes: 09-11 fijo, y una clase 13-15 que sólo ocurre en Semana A.
    // Semana A: hueco de 11 a 13 = 2 h. Semana B: sin hueco. Promedio: 1 h.
    const courses = [
      curso('AA', [{ number: 1, sessions: [sesion('Lun', '09:00', '11:00')] }]),
      curso('BB', [{ number: 1, sessions: [sesion('Lun', '13:00', '15:00', { frequency: 'Semana A' })] }]),
    ];
    expect(solveSchedule(courses, ['AA', 'BB']).candidates[0].deadMinutes).toBe(60);
  });

  it('suma los huecos de todos los días', () => {
    const courses = [
      curso('AA', [{ number: 1, sessions: [sesion('Lun', '09:00', '11:00'), sesion('Mar', '09:00', '11:00')] }]),
      curso('BB', [{ number: 1, sessions: [sesion('Lun', '13:00', '15:00'), sesion('Mar', '14:00', '16:00')] }]),
    ];
    // Lun: 2 h de hueco. Mar: 3 h. Total 5 h.
    expect(solveSchedule(courses, ['AA', 'BB']).candidates[0].deadMinutes).toBe(300);
  });

  it('con las mismas horas muertas prefiere concentrar las clases en menos días', () => {
    const courses = [
      curso('AA', [{ number: 1, sessions: [sesion('Lun', '09:00', '11:00')] }]),
      curso('BB', [
        { number: 1, sessions: [sesion('Mar', '09:00', '11:00')] }, // 2 días, 0 huecos
        { number: 2, sessions: [sesion('Lun', '11:00', '13:00')] }, // 1 día, 0 huecos
      ]),
    ];
    const result = solveSchedule(courses, ['AA', 'BB']);
    expect(result.candidates[0].deadMinutes).toBe(0);
    expect(result.candidates[0].daysWithClass).toBe(1);
    expect(combo(result.candidates[0].selection)).toEqual(['AA-1', 'BB-2']);
  });
});

describe('solveSchedule — sin solución', () => {
  it('señala el par de cursos incompatibles', () => {
    const courses = [
      curso('AA', [{ number: 1, sessions: [sesion('Lun', '09:00', '11:00')] }]),
      curso('BB', [{ number: 1, sessions: [sesion('Mar', '09:00', '11:00')] }]),
      curso('CC', [{ number: 1, sessions: [sesion('Lun', '10:00', '12:00')] }]),
    ];
    const result = solveSchedule(courses, ['AA', 'BB', 'CC']);
    expect(result.evaluatedCount).toBe(0);
    expect(result.candidates).toEqual([]);
    expect([result.blockingPair?.courseCodeA, result.blockingPair?.courseCodeB].sort())
      .toEqual(['AA', 'CC']);
  });

  it('deja blockingPair sin definir cuando ningún par es culpable por sí solo', () => {
    // Tres cursos compatibles de a pares, pero no los tres juntos: cada uno tiene
    // dos secciones y siempre queda uno sin slot libre.
    const courses = [
      curso('AA', [
        { number: 1, sessions: [sesion('Lun', '09:00', '10:00')] },
        { number: 2, sessions: [sesion('Lun', '10:00', '11:00')] },
      ]),
      curso('BB', [
        { number: 1, sessions: [sesion('Lun', '09:00', '10:00')] },
        { number: 2, sessions: [sesion('Lun', '10:00', '11:00')] },
      ]),
      curso('CC', [
        { number: 1, sessions: [sesion('Lun', '09:00', '10:00')] },
        { number: 2, sessions: [sesion('Lun', '10:00', '11:00')] },
      ]),
    ];
    const result = solveSchedule(courses, ['AA', 'BB', 'CC']);
    expect(result.evaluatedCount).toBe(0);
    expect(result.blockingPair).toBeUndefined();
  });
});

describe('solveSchedule — entradas degeneradas', () => {
  it('ignora los códigos que ya no están en el catálogo', () => {
    const courses = [curso('AA', [{ number: 1, sessions: [sesion('Lun', '09:00', '11:00')] }])];
    const result = solveSchedule(courses, ['AA', 'NO-EXISTE']);
    expect(result.evaluatedCount).toBe(1);
    expect(combo(result.candidates[0].selection)).toEqual(['AA-1']);
  });

  it('sin cursos válidos devuelve vacío sin marcar culpables', () => {
    const result = solveSchedule([], ['AA']);
    expect(result).toEqual({ candidates: [], evaluatedCount: 0, exhaustive: true });
  });

  it('respeta el topN', () => {
    const courses = [
      curso('AA', [
        { number: 1, sessions: [sesion('Lun', '09:00', '11:00')] },
        { number: 2, sessions: [sesion('Mar', '09:00', '11:00')] },
        { number: 3, sessions: [sesion('Mie', '09:00', '11:00')] },
      ]),
    ];
    const result = solveSchedule(courses, ['AA'], { topN: 2 });
    expect(result.evaluatedCount).toBe(3);
    expect(result.candidates).toHaveLength(2);
  });

  it('al pasarse del tope de nodos avisa que el resultado puede no ser óptimo', () => {
    const result = solveSchedule(coursesData as Course[], ['CS6003', 'CC6105', 'CC6101', 'HH6001', 'PI6001'], {
      maxNodes: 500,
    });
    expect(result.exhaustive).toBe(false);
  });
});

describe('solveSchedule — contra la oferta real', () => {
  const courses = coursesData as Course[];

  /** Enumeración ingenua, sin podas, para contrastar. */
  function bruteForce(codes: string[]): { best: number; total: number } {
    const groups = codes.map(code => buildCourseOptions(courses.find(c => c.code === code)!));
    let best = Infinity;
    let total = 0;

    function deadSlots(mask: number[]): number {
      let acc = 0;
      for (const bits of mask) {
        if (bits === 0) continue;
        let first = -1;
        let last = -1;
        let busy = 0;
        for (let slot = 0; slot < 15; slot++) {
          if (bits & (1 << slot)) {
            if (first < 0) first = slot;
            last = slot;
            busy++;
          }
        }
        acc += last - first + 1 - busy;
      }
      return acc;
    }

    function rec(depth: number, a: number[], b: number[]): void {
      if (depth === groups.length) {
        total++;
        best = Math.min(best, ((deadSlots(a) + deadSlots(b)) * 60) / 2);
        return;
      }
      for (const option of groups[depth]) {
        let clash = false;
        for (let day = 0; day < 6 && !clash; day++) {
          if ((a[day] & option.weekA[day]) || (b[day] & option.weekB[day])) clash = true;
        }
        if (clash) continue;
        rec(
          depth + 1,
          a.map((v, day) => v | option.weekA[day]),
          b.map((v, day) => v | option.weekB[day])
        );
      }
    }

    rec(0, new Array(6).fill(0), new Array(6).fill(0));
    return { best, total };
  }

  it('las podas no descartan el óptimo', () => {
    const codes = ['CS6003', 'CC6105', 'CC6101', 'HH6001'];
    const naive = bruteForce(codes);
    const result = solveSchedule(courses, codes);

    expect(result.exhaustive).toBe(true);
    expect(result.candidates[0].deadMinutes).toBe(naive.best);
    // La cota inferior corta ramas enteras, así que se evalúan menos
    // combinaciones que las que existen. El óptimo igual sobrevive.
    expect(result.evaluatedCount).toBeLessThan(naive.total);
    expect(result.evaluatedCount).toBeGreaterThan(0);
  });

  it('sin la poda por cota el conteo coincide con la enumeración ingenua', () => {
    // Con topN por encima del total de soluciones el top nunca se llena, y sin
    // top lleno la cota no se aplica: queda a la vista que la poda por cruces
    // no pierde ninguna combinación por su cuenta.
    const codes = ['CS6003', 'CC6105'];
    const naive = bruteForce(codes);
    const result = solveSchedule(courses, codes, { topN: naive.total + 1 });
    expect(result.evaluatedCount).toBe(naive.total);
  });

  it('un topN grande no degrada la búsqueda', () => {
    // Con la clave de desempate recalculada en cada comparación, este caso
    // tardaba minutos en vez de milisegundos. El timeout es la aserción.
    const result = solveSchedule(courses, ['CS6003', 'CC6105', 'CC6101', 'HH6001', 'PI6001'], {
      topN: 50_000,
    });
    expect(result.candidates.length).toBeGreaterThan(1000);
    expect(result.candidates[0].deadMinutes).toBe(0);
  }, 10_000);

  it('es determinista: la misma entrada devuelve exactamente los mismos candidatos', () => {
    const codes = ['CS6003', 'CC6105', 'CC6101', 'HH6001', 'PI6001'];
    const a = solveSchedule(courses, codes);
    const b = solveSchedule(courses, codes);
    expect(a.candidates).toEqual(b.candidates);
  });

  it('los candidatos vienen ordenados de menos a más horas muertas', () => {
    const result = solveSchedule(courses, ['CS6003', 'CC6105', 'CC6101', 'HH6001', 'PI6001'], { topN: 10 });
    const dead = result.candidates.map(c => c.deadMinutes);
    expect(dead).toEqual([...dead].sort((x, y) => x - y));
  });
});
