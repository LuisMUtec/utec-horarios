import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeTeacherEmail } from '@/lib/teacher-email';
import courses from '@/data/courses.json';
import type { Course } from '@/types';

// El precio de D5 es el drift: regenerar courses.json sin regenerar la
// migración deja la interfaz ofreciendo pares que la FK rechaza, y el fallo
// aparece recién cuando un alumno intenta publicar. Esto lo vuelve un CI rojo.

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

function latestOfferMigration(): string {
  const file = readdirSync(MIGRATIONS_DIR)
    .filter((name) => /_oferta_\d{4}_\d\.sql$/.test(name))
    .sort()
    .pop();
  if (!file) throw new Error('No hay migración de oferta. Corre `pnpm generate-offer`.');
  return readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
}

function pairsInMigration(sql: string): Set<string> {
  const pairs = new Set<string>();
  for (const [, courseCode, teacherEmail] of sql.matchAll(/^\s*\('([^']+)',\s*'([^']+)',/gm)) {
    pairs.add(`${courseCode} ${teacherEmail}`);
  }
  return pairs;
}

function pairsInOffer(): Set<string> {
  const pairs = new Set<string>();
  for (const course of courses as Course[]) {
    for (const section of course.sections) {
      for (const session of section.sessions) {
        const email = normalizeTeacherEmail(session.email);
        if (email) pairs.add(`${course.code} ${email}`);
      }
    }
  }
  return pairs;
}

describe('la migración de oferta sigue a courses.json', () => {
  const migration = latestOfferMigration();
  const inMigration = pairsInMigration(migration);
  const inOffer = pairsInOffer();

  it('no le faltan pares que sí están en la oferta', () => {
    const missing = [...inOffer].filter((pair) => !inMigration.has(pair));
    expect(missing, 'Corre `pnpm diff-oferta` y luego `pnpm generate-offer`.').toEqual([]);
  });

  it('no trae pares que la oferta ya no tiene', () => {
    const stale = [...inMigration].filter((pair) => !inOffer.has(pair));
    expect(stale, 'Regenerar la migración los apaga con is_current = false.').toEqual([]);
  });

  it('emite todos los correos ya normalizados', () => {
    // La unique de la tabla no detecta un correo sucio: son dos pares distintos.
    const dirty = [...inMigration]
      .map((pair) => pair.split(' ')[1])
      .filter((email) => normalizeTeacherEmail(email) !== email);
    expect(dirty).toEqual([]);
  });

  it('apaga explícitamente lo que sale de la oferta', () => {
    expect(migration).toMatch(/update public\.course_teachers\s+set is_current = false/);
  });
});
