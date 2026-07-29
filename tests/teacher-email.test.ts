import { describe, it, expect } from 'vitest';
import { normalizeTeacherEmail, teacherPairKey } from '@/lib/teacher-email';
import courses from '@/data/courses.json';
import type { Course } from '@/types';

describe('normalizeTeacherEmail', () => {
  it('deja intacto un correo que ya está limpio', () => {
    expect(normalizeTeacherEmail('bojeda@utec.edu.pe')).toBe('bojeda@utec.edu.pe');
  });

  it('quita la capacidad que el PDF pega al final', () => {
    expect(normalizeTeacherEmail('pperezq@utec.edu.pe 44')).toBe('pperezq@utec.edu.pe');
    expect(normalizeTeacherEmail('mcueva@utec.edu.pe 9')).toBe('mcueva@utec.edu.pe');
    expect(normalizeTeacherEmail('aagapito@utec.edu.pe 999')).toBe('aagapito@utec.edu.pe');
  });

  it('cierra el dominio partido por el salto de línea', () => {
    expect(normalizeTeacherEmail('rcondorena@utec.edu. pe')).toBe('rcondorena@utec.edu.pe');
    expect(normalizeTeacherEmail('amorantep@utec.edu.p e')).toBe('amorantep@utec.edu.pe');
    expect(normalizeTeacherEmail('lchuquisengo@utec.edu .pe')).toBe('lchuquisengo@utec.edu.pe');
    expect(normalizeTeacherEmail('jsanchez@utec. edu.pe')).toBe('jsanchez@utec.edu.pe');
  });

  it('resuelve los dos defectos a la vez', () => {
    // Es el caso que obliga a quitar la capacidad antes de colapsar espacios.
    expect(normalizeTeacherEmail('acollantes@utec.edu.p e 99')).toBe('acollantes@utec.edu.pe');
    expect(normalizeTeacherEmail('gsandoval@utec.edu .pe 8')).toBe('gsandoval@utec.edu.pe');
  });

  it('normaliza mayúsculas y espacios de los extremos', () => {
    expect(normalizeTeacherEmail('  BOjeda@UTEC.edu.PE ')).toBe('bojeda@utec.edu.pe');
  });

  it('devuelve null cuando el campo solo trae la capacidad', () => {
    expect(normalizeTeacherEmail('65')).toBeNull();
    expect(normalizeTeacherEmail('92')).toBeNull();
  });

  it('devuelve null cuando no hay nada que normalizar', () => {
    expect(normalizeTeacherEmail('')).toBeNull();
    expect(normalizeTeacherEmail('   ')).toBeNull();
    expect(normalizeTeacherEmail(null)).toBeNull();
    expect(normalizeTeacherEmail(undefined)).toBeNull();
  });

  it('rechaza correos fuera del dominio institucional', () => {
    expect(normalizeTeacherEmail('alguien@gmail.com')).toBeNull();
    expect(normalizeTeacherEmail('alguien@utec.edu.pe.co')).toBeNull();
    expect(normalizeTeacherEmail('alguien@sub.utec.edu.pe')).toBeNull();
    expect(normalizeTeacherEmail('@utec.edu.pe')).toBeNull();
    expect(normalizeTeacherEmail('Ojeda Rios, Brenner Humberto')).toBeNull();
  });
});

describe('teacherPairKey', () => {
  it('es estable frente a mayúsculas y espacios', () => {
    expect(teacherPairKey(' cs2023 ', ' BOjeda@utec.edu.pe ')).toBe(
      teacherPairKey('CS2023', 'bojeda@utec.edu.pe')
    );
  });

  it('separa al mismo docente en cursos distintos', () => {
    expect(teacherPairKey('CS2023', 'bojeda@utec.edu.pe')).not.toBe(
      teacherPairKey('CS1101', 'bojeda@utec.edu.pe')
    );
  });
});

describe('la oferta vigente, ya normalizada', () => {
  // Si estas cifras cambian sin que nadie lo decida, se regeneró courses.json o
  // se rompió el normalizador; en los dos casos hay que revisar la migración de
  // oferta antes de desplegar.
  const sessions = (courses as Course[]).flatMap((course) =>
    course.sections.flatMap((section) =>
      section.sessions.map((session) => ({ course, session }))
    )
  );

  const withTeacher = sessions
    .map(({ course, session }) => ({
      course,
      email: normalizeTeacherEmail(session.email),
    }))
    .filter((entry) => entry.email !== null);

  it('tiene 1904 sesiones', () => {
    expect(sessions).toHaveLength(1904);
  });

  it('deja 190 sesiones sin docente evaluable', () => {
    expect(sessions.length - withTeacher.length).toBe(190);
  });

  it('no descarta ningún docente al descartar esas sesiones', () => {
    // Ninguna sesión sin correo recuperable trae nombre: son exactamente el
    // estado `Docente por asignar`, no docentes que se estén perdiendo.
    const lost = sessions.filter(
      ({ session }) =>
        normalizeTeacherEmail(session.email) === null && (session.professor?.trim() ?? '') !== ''
    );
    expect(lost).toHaveLength(0);
  });

  it('identifica 375 docentes distintos', () => {
    expect(new Set(withTeacher.map((entry) => entry.email)).size).toBe(375);
  });

  it('produce 761 pares docente–curso reseñables', () => {
    const pairs = new Set(
      withTeacher.map((entry) => teacherPairKey(entry.course.code, entry.email!))
    );
    expect(pairs.size).toBe(761);
  });

  it('no necesita rescatar ningún correo: la fuente ya viene limpia', () => {
    // Con el PDF eran 344 sesiones rescatadas; el xlsx trae una celda por campo
    // y no parte nada. El normalizador se queda como red: si vuelve a haber
    // correos sucios, este test lo dice antes de que se cuelen a la migración.
    const recovered = sessions.filter(
      ({ session }) =>
        normalizeTeacherEmail(session.email) !== null &&
        normalizeTeacherEmail(session.email) !== session.email
    );
    expect(recovered).toHaveLength(0);
  });
});
