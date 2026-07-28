import { describe, it, expect } from 'vitest';
import { analyzeSection, getFilteredSessions } from '@/lib/subsession-utils';
import type { Section, Session } from '@/types';

/**
 * Cubre el caché WeakMap de analyzeSection. El caché existe porque el análisis
 * se recomputaba en cada hover desde tres componentes distintos; estos tests
 * fijan que cachear no cambió el resultado.
 */

function session(type: string, capacity: number, overrides: Partial<Session> = {}): Session {
  return {
    type,
    day: 'Lun',
    startTime: '09:00',
    endTime: '11:00',
    modality: 'Presencial',
    location: 'A101',
    capacity,
    enrolled: 0,
    professor: 'DOCENTE',
    email: '',
    frequency: '',
    ...overrides,
  } as Session;
}

/** Teoría de capacidad alta (obligatoria) + dos labs de capacidad menor. */
function seccionConSubsesiones(): Section {
  return {
    number: 1,
    sessions: [
      session('TEORÍA 1', 60),
      session('LABORATORIO 11', 30, { day: 'Mar' }),
      session('LABORATORIO 12', 30, { day: 'Jue' }),
    ],
  } as Section;
}

describe('analyzeSection — caché', () => {
  it('devuelve la misma referencia para la misma sección', () => {
    const section = seccionConSubsesiones();
    expect(analyzeSection(section)).toBe(analyzeSection(section));
  });

  it('secciones distintas con igual contenido no comparten caché', () => {
    // El caché es por identidad de objeto, no por valor.
    expect(analyzeSection(seccionConSubsesiones())).not.toBe(
      analyzeSection(seccionConSubsesiones())
    );
  });

  it('el resultado cacheado es equivalente al recién computado', () => {
    const a = analyzeSection(seccionConSubsesiones());
    const b = analyzeSection(seccionConSubsesiones());
    expect(a).toEqual(b);
  });
});

describe('analyzeSection — clasificación', () => {
  it('separa obligatorias de subsesiones por capacidad', () => {
    const analysis = analyzeSection(seccionConSubsesiones());
    expect(analysis.hasMandatorySessions).toBe(true);
    expect(analysis.mandatorySessions.map(s => s.type)).toEqual(['TEORÍA 1']);
    expect(analysis.subsessionGroups.map(g => g.id)).toEqual([
      'LABORATORIO-11',
      'LABORATORIO-12',
    ]);
  });

  it('con una sola capacidad no hay subsesiones', () => {
    const section = {
      number: 1,
      sessions: [session('TEORÍA 1', 40), session('TEORÍA 2', 40)],
    } as Section;
    const analysis = analyzeSection(section);
    expect(analysis.subsessionGroups).toEqual([]);
    expect(analysis.mandatorySessions).toHaveLength(2);
  });

  it('mantiene separadas las subsesiones con sufijo decimal', () => {
    // "TEORÍA 23.01" y "TEORÍA 23.02" son opciones distintas, no la misma.
    const section = {
      number: 1,
      sessions: [
        session('TEORÍA 1', 60),
        session('TEORÍA 23.01', 20),
        session('TEORÍA 23.02', 20),
      ],
    } as Section;
    expect(analyzeSection(section).subsessionGroups.map(g => g.id)).toEqual([
      'TEORÍA-23.01',
      'TEORÍA-23.02',
    ]);
  });
});

describe('getFilteredSessions', () => {
  it('sin subsessionId devuelve solo las obligatorias', () => {
    const tipos = getFilteredSessions(seccionConSubsesiones()).map(s => s.type);
    expect(tipos).toEqual(['TEORÍA 1']);
  });

  it('con subsessionId agrega esa subsesión a las obligatorias', () => {
    const tipos = getFilteredSessions(seccionConSubsesiones(), 'LABORATORIO-11').map(s => s.type);
    expect(tipos).toEqual(['TEORÍA 1', 'LABORATORIO 11']);
  });

  it('con un subsessionId inexistente cae a las obligatorias sin romper', () => {
    // Escenario real del cambio de ciclo: el alumno tenía guardado un lab que
    // el PDF nuevo ya no trae. Hoy pierde el lab en silencio.
    const tipos = getFilteredSessions(seccionConSubsesiones(), 'LABORATORIO-99').map(s => s.type);
    expect(tipos).toEqual(['TEORÍA 1']);
  });

  it('sin subsesiones devuelve todas las sesiones', () => {
    const section = {
      number: 1,
      sessions: [session('TEORÍA 1', 40), session('TEORÍA 2', 40)],
    } as Section;
    expect(getFilteredSessions(section)).toHaveLength(2);
  });
});
