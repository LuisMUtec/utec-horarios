import { describe, it, expect } from 'vitest';
import coursesData from '@/data/courses.json';
import { DAYS } from '@/lib/schedule-utils';
import type { Course } from '@/types';

/**
 * Invariantes sobre los datos generados desde el PDF.
 *
 * El riesgo recurrente del proyecto es el update de ciclo: se reemplaza el PDF,
 * se corre `pnpm parse-pdf` y se deploya. Si el parseo sale mal, hoy nadie se
 * entera hasta que un alumno ve un horario roto. Estos tests corren sobre el
 * courses.json commiteado y fallan antes del deploy.
 */

const courses = coursesData as Course[];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const allSessions = courses.flatMap(course =>
  course.sections.flatMap(section =>
    section.sessions.map(session => ({ course, section, session }))
  )
);

function label(course: Course, sectionNumber: number, type: string): string {
  return `${course.code} secc.${sectionNumber} "${type}"`;
}

describe('courses.json — estructura', () => {
  it('tiene cursos', () => {
    expect(courses.length).toBeGreaterThan(0);
  });

  it('no tiene códigos de curso duplicados', () => {
    const codes = courses.map(c => c.code);
    const duplicados = codes.filter((code, i) => codes.indexOf(code) !== i);
    expect([...new Set(duplicados)]).toEqual([]);
  });

  it('todo código de curso tiene el formato de 2 letras + 4 dígitos', () => {
    const malos = courses.filter(c => !/^[A-Z]{2}\d{4}$/.test(c.code)).map(c => c.code);
    expect(malos).toEqual([]);
  });

  it('todo curso tiene nombre no vacío', () => {
    const sinNombre = courses.filter(c => !c.name?.trim()).map(c => c.code);
    expect(sinNombre).toEqual([]);
  });

  it('todo curso tiene al menos una sección', () => {
    const vacios = courses.filter(c => c.sections.length === 0).map(c => c.code);
    expect(vacios).toEqual([]);
  });

  it('los números de sección son únicos dentro de cada curso', () => {
    const conflictos = courses
      .filter(c => new Set(c.sections.map(s => s.number)).size !== c.sections.length)
      .map(c => c.code);
    expect(conflictos).toEqual([]);
  });

  it('toda sección tiene al menos una sesión', () => {
    const vacias = courses.flatMap(c =>
      c.sections.filter(s => s.sessions.length === 0).map(s => `${c.code} secc.${s.number}`)
    );
    expect(vacias).toEqual([]);
  });
});

describe('courses.json — sesiones', () => {
  it('todo day es uno de los días conocidos', () => {
    // El parser mapea "Mié" -> "Mie" y "Sáb" -> "Sab". Un acento nuevo en el PDF
    // rompería ese mapeo en silencio y la sesión no se dibujaría nunca.
    const malos = allSessions
      .filter(({ session }) => !(DAYS as readonly string[]).includes(session.day))
      .map(({ course, section, session }) => `${label(course, section.number, session.type)}: día "${session.day}"`);
    expect(malos).toEqual([]);
  });

  it('todo horario tiene formato HH:MM válido', () => {
    const malos = allSessions
      .filter(({ session }) => !TIME_RE.test(session.startTime) || !TIME_RE.test(session.endTime))
      .map(({ course, section, session }) =>
        `${label(course, section.number, session.type)}: ${session.startTime}-${session.endTime}`
      );
    expect(malos).toEqual([]);
  });

  it('endTime es posterior a startTime', () => {
    const malos = allSessions
      .filter(({ session }) => session.endTime <= session.startTime)
      .map(({ course, section, session }) =>
        `${label(course, section.number, session.type)}: ${session.startTime}-${session.endTime}`
      );
    expect(malos).toEqual([]);
  });

  it('toda sesión cae dentro de la grilla del calendario (07:00-22:00)', () => {
    // Fuera de este rango el bloque se renderiza fuera de la grilla visible.
    const malos = allSessions
      .filter(({ session }) => session.startTime < '07:00' || session.endTime > '22:00')
      .map(({ course, section, session }) =>
        `${label(course, section.number, session.type)}: ${session.startTime}-${session.endTime}`
      );
    expect(malos).toEqual([]);
  });

  it('toda sesión tiene un type no vacío', () => {
    const malos = allSessions
      .filter(({ session }) => !session.type?.trim())
      .map(({ course, section }) => `${course.code} secc.${section.number}`);
    expect(malos).toEqual([]);
  });

  it('enrolled nunca supera capacity', () => {
    const malos = allSessions
      .filter(({ session }) =>
        typeof session.capacity === 'number' &&
        typeof session.enrolled === 'number' &&
        session.enrolled > session.capacity
      )
      .map(({ course, section, session }) =>
        `${label(course, section.number, session.type)}: ${session.enrolled}/${session.capacity}`
      );
    expect(malos).toEqual([]);
  });

  it('capacity y enrolled no son negativos', () => {
    const malos = allSessions
      .filter(({ session }) => session.capacity < 0 || session.enrolled < 0)
      .map(({ course, section, session }) =>
        `${label(course, section.number, session.type)}: ${session.enrolled}/${session.capacity}`
      );
    expect(malos).toEqual([]);
  });
});
