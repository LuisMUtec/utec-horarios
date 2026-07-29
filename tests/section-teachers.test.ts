import { describe, it, expect } from 'vitest';
import type { Session } from '@/types';
import type { TeacherSummary } from '@/types/reviews';
import {
  canOpenDetail,
  indexSummaries,
  sectionTeachers,
  teacherSummaryState,
  type CourseSummaryState,
} from '@/lib/section-teachers';

function session(partial: Partial<Session>): Session {
  return {
    type: 'TEORÍA 1',
    modality: 'Presencial',
    day: 'Lun',
    startTime: '09:00',
    endTime: '11:00',
    frequency: 'Semana General',
    location: 'UTEC-BA A904',
    capacity: 45,
    enrolled: 10,
    professor: 'Ojeda Rios, Brenner Humberto',
    email: 'bojeda@utec.edu.pe',
    ...partial,
  };
}

function summary(partial: Partial<TeacherSummary>): TeacherSummary {
  return {
    courseTeacherId: '1',
    courseCode: 'CS2023',
    teacherEmail: 'bojeda@utec.edu.pe',
    teacherName: 'Ojeda Rios, Brenner Humberto',
    averageRating: 4.3,
    ratingCount: 12,
    commentCount: 3,
    recommendPercentage: 82,
    ...partial,
  };
}

describe('sectionTeachers — identidad por correo', () => {
  // FR-009
  it('un docente en varias sesiones de la sección aparece una sola vez', () => {
    const teachers = sectionTeachers('CS2023', [
      session({ type: 'TEORÍA 1' }),
      session({ type: 'LABORATORIO 1' }),
      session({ type: 'TEORÍA 1', day: 'Mie' }),
    ]);

    expect(teachers).toEqual([
      {
        key: 'CS2023|bojeda@utec.edu.pe',
        pairKey: 'CS2023|bojeda@utec.edu.pe',
        email: 'bojeda@utec.edu.pe',
        name: 'Ojeda Rios, Brenner Humberto',
      },
    ]);
  });

  // FR-010
  it('varios docentes en la sección dan una entrada cada uno, en orden', () => {
    const teachers = sectionTeachers('CS2023', [
      session({ professor: 'Ojeda Rios, Brenner', email: 'bojeda@utec.edu.pe' }),
      session({ professor: 'Salazar, Luis', email: 'lsalazar@utec.edu.pe' }),
    ]);

    expect(teachers.map((t) => t.pairKey)).toEqual([
      'CS2023|bojeda@utec.edu.pe',
      'CS2023|lsalazar@utec.edu.pe',
    ]);
  });

  // FR-053: el mismo correo escrito de dos formas no se divide en dos.
  it('normaliza el correo sucio del PDF antes de agrupar', () => {
    const teachers = sectionTeachers('CS2023', [
      session({ email: 'lsalazar@utec.edu.pe 34', professor: 'Salazar, Luis' }),
      session({ email: 'LSalazar@utec.edu. pe', professor: 'SALAZAR, LUIS' }),
    ]);

    expect(teachers).toEqual([
      {
        key: 'CS2023|lsalazar@utec.edu.pe',
        pairKey: 'CS2023|lsalazar@utec.edu.pe',
        email: 'lsalazar@utec.edu.pe',
        name: 'Salazar, Luis',
      },
    ]);
  });

  // FR-053: dos homónimos no comparten reseñas.
  it('dos correos distintos con el mismo nombre son dos docentes', () => {
    const teachers = sectionTeachers('CS2023', [
      session({ professor: 'Perez, Juan', email: 'jperez@utec.edu.pe' }),
      session({ professor: 'Perez, Juan', email: 'jperezb@utec.edu.pe' }),
    ]);

    expect(teachers).toHaveLength(2);
  });

  // FR-011: la llave no depende de la sección, así que dos secciones coinciden.
  it('el mismo docente en dos secciones del curso comparte llave', () => {
    const [uno] = sectionTeachers('CS2023', [session({ type: 'TEORÍA 1' })]);
    const [dos] = sectionTeachers('CS2023', [session({ type: 'TEORÍA 2' })]);

    expect(uno.pairKey).toBe(dos.pairKey);
  });

  it('el curso forma parte de la llave', () => {
    const [cs] = sectionTeachers('CS2023', [session({})]);
    const [ma] = sectionTeachers('MA1002', [session({})]);

    expect(cs.pairKey).not.toBe(ma.pairKey);
  });

  it('normaliza el código de curso en minúsculas', () => {
    const [teacher] = sectionTeachers('cs2023', [session({})]);
    expect(teacher.pairKey).toBe('CS2023|bojeda@utec.edu.pe');
  });
});

describe('sectionTeachers — sin correo recuperable', () => {
  // FR-054
  it('una sesión sin correo da un docente sin par', () => {
    const [teacher] = sectionTeachers('CS2023', [session({ professor: '', email: '' })]);

    expect(teacher).toEqual({ key: 'sin-correo|', pairKey: null, email: null, name: '' });
  });

  // El detalle se abre con el correo, así que sin par tampoco hay correo: es lo
  // que impide ofrecer «Ver comentarios» sobre un Docente por asignar (T062).
  it('sin par tampoco hay correo con el que pedir el detalle', () => {
    const teachers = sectionTeachers('CS2023', [
      session({ professor: 'Externo, Ana', email: 'ana@gmail.com' }),
      session({ professor: '', email: '' }),
    ]);

    expect(teachers.every((t) => t.email === null)).toBe(true);
  });

  it('un correo que no es institucional tampoco forma par', () => {
    const [teacher] = sectionTeachers('CS2023', [
      session({ professor: 'Externo, Ana', email: 'ana@gmail.com' }),
    ]);

    expect(teacher.pairKey).toBeNull();
    expect(teacher.name).toBe('Externo, Ana');
  });

  it('conserva el nombre cuando hay nombre pero no correo', () => {
    const teachers = sectionTeachers('CS2023', [
      session({ professor: 'Externo, Ana', email: '' }),
      session({ professor: 'Externo, Ana', email: '' }),
      session({ professor: 'Visitante, Beto', email: '' }),
    ]);

    expect(teachers.map((t) => t.name)).toEqual(['Externo, Ana', 'Visitante, Beto']);
    expect(teachers.every((t) => t.pairKey === null)).toBe(true);
  });
});

describe('sectionTeachers — caché por identidad del arreglo', () => {
  it('la segunda llamada devuelve la misma referencia', () => {
    const sessions = [session({})];
    expect(sectionTeachers('CS2023', sessions)).toBe(sectionTeachers('CS2023', sessions));
  });
});

describe('cada subsección se resuelve sola', () => {
  const mandatory = sectionTeachers('CS2023', [session({})]);

  // Hubo una versión que descontaba de la subsección los docentes ya mostrados
  // en la cabecera. Dejaba sin ninguna fila a la opción cuyo docente era el de
  // la obligatoria —CC1101 sección 1, TEORÍA 11 y 14 en la oferta real—, así que
  // el estudiante veía dos opciones con estado y dos con un hueco.
  it('la subsección del mismo docente de la obligatoria conserva su fila', () => {
    const group = sectionTeachers('CS2023', [session({ type: 'LABORATORIO 11' })]);

    expect(group.map((t) => t.name)).toEqual(mandatory.map((t) => t.name));
    expect(group[0].pairKey).toBe(mandatory[0].pairKey); // mismo resumen (FR-011)
  });

  // CC1143 sección 2: la única opción sin docente era la única sin el chip.
  it('la subsección sin docente conserva su "Docente por asignar"', () => {
    const sinCorreo = sectionTeachers('CS2023', [session({ professor: '', email: '' })]);

    expect(sinCorreo).toHaveLength(1);
    expect(sinCorreo[0].pairKey).toBeNull();
  });

  // CC1103 sección 1: el mismo docente en dos grupos de laboratorio.
  it('dos subsecciones hermanas del mismo docente comparten par y ambas lo muestran', () => {
    const lab13 = sectionTeachers('CS2023', [
      session({ type: 'LABORATORIO 13', professor: 'Chavez, Xyoby', email: 'xchavez@utec.edu.pe' }),
    ]);
    const lab14 = sectionTeachers('CS2023', [
      session({ type: 'LABORATORIO 14', professor: 'Chavez, Xyoby', email: 'xchavez@utec.edu.pe' }),
    ]);

    expect(lab13).toHaveLength(1);
    expect(lab14).toHaveLength(1);
    expect(lab13[0].pairKey).toBe(lab14[0].pairKey);
  });
});

describe('indexSummaries', () => {
  it('indexa por par docente–curso', () => {
    const index = indexSummaries([summary({}), summary({ teacherEmail: 'lsalazar@utec.edu.pe' })]);

    expect([...index.keys()]).toEqual([
      'CS2023|bojeda@utec.edu.pe',
      'CS2023|lsalazar@utec.edu.pe',
    ]);
  });

  // FR-011: una sola fila alcanza para todas las secciones donde dicta.
  it('la llave coincide con la que arma sectionTeachers', () => {
    const index = indexSummaries([summary({})]);
    const [teacher] = sectionTeachers('CS2023', [session({})]);

    expect(index.get(teacher.pairKey!)).toBeDefined();
  });
});

describe('teacherSummaryState', () => {
  const [teacher] = sectionTeachers('CS2023', [session({})]);
  const [unassigned] = sectionTeachers('CS2023', [session({ email: '', professor: '' })]);

  const ready: CourseSummaryState = { kind: 'ready', byPairKey: indexSummaries([summary({})]) };

  // T037
  it('sin Supabase no se renderiza nada, ni siquiera Docente por asignar', () => {
    expect(teacherSummaryState(teacher, { kind: 'disabled' })).toBeNull();
    expect(teacherSummaryState(unassigned, { kind: 'disabled' })).toBeNull();
  });

  it('devuelve el resumen del par cuando existe', () => {
    expect(teacherSummaryState(teacher, ready)).toEqual({
      kind: 'summary',
      summary: summary({}),
    });
  });

  // FR-007: hay docente, nadie lo evaluó.
  it('un par sin fila en la vista es empty, no error', () => {
    const [otro] = sectionTeachers('CS2023', [
      session({ email: 'lsalazar@utec.edu.pe', professor: 'Salazar, Luis' }),
    ]);
    expect(teacherSummaryState(otro, ready)).toEqual({ kind: 'empty' });
  });

  // SC-002: carga y fallo no pueden parecerse a un docente sin reseñas.
  it.each([['loading'], ['error']] as const)('propaga el estado %s del curso', (kind) => {
    expect(teacherSummaryState(teacher, { kind })).toEqual({ kind });
  });

  // FR-054
  it('sin par es unassigned aunque el curso siga cargando', () => {
    expect(teacherSummaryState(unassigned, { kind: 'loading' })).toEqual({ kind: 'unassigned' });
    expect(teacherSummaryState(unassigned, { kind: 'error' })).toEqual({ kind: 'unassigned' });
    expect(teacherSummaryState(unassigned, ready)).toEqual({ kind: 'unassigned' });
  });
});

describe('canOpenDetail', () => {
  const [conCorreo] = sectionTeachers('CS2023', [session({})]);
  const [sinCorreo] = sectionTeachers('CS2023', [session({ email: '', professor: '' })]);
  const ready: CourseSummaryState = { kind: 'ready', byPairKey: indexSummaries([summary({})]) };

  it('con resumen resuelto se puede abrir', () => {
    expect(canOpenDetail(conCorreo, teacherSummaryState(conCorreo, ready))).toBe(true);
  });

  // FR-007: sin puntuaciones no significa sin comentarios que leer más adelante,
  // y escenario 27 pide poder abrirlo igual.
  it('sin puntuaciones también se puede abrir', () => {
    const [otro] = sectionTeachers('CS2023', [
      session({ email: 'lsalazar@utec.edu.pe', professor: 'Salazar, Luis' }),
    ]);
    expect(canOpenDetail(otro, teacherSummaryState(otro, ready))).toBe(true);
  });

  // T062
  it('un Docente por asignar no ofrece detalle', () => {
    expect(canOpenDetail(sinCorreo, teacherSummaryState(sinCorreo, ready))).toBe(false);
  });

  it.each([['loading'], ['error']] as const)('con el curso en %s todavía no', (kind) => {
    expect(canOpenDetail(conCorreo, teacherSummaryState(conCorreo, { kind }))).toBe(false);
  });

  it('sin Supabase no hay nada que abrir', () => {
    expect(canOpenDetail(conCorreo, teacherSummaryState(conCorreo, { kind: 'disabled' }))).toBe(
      false
    );
  });
});
