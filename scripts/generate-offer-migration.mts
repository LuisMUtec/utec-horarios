// Genera la migración que refresca `public.course_teachers` (D4).
//
//   pnpm generate-offer   escribe supabase/migrations/<ts>_oferta_<año>_<ciclo>.sql
//   pnpm diff-oferta      no escribe: lista los pares que entran y salen
//
// Mira el diff antes de generar: un par que sale apaga sus reseñas (R6).
// Corre con `node` a secas (type stripping nativo, Node >= 22.18).

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeTeacherEmail } from '../src/lib/teacher-email.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');

type Pair = { courseCode: string; teacherEmail: string; teacherName: string };

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Un mismo par aparece en varias sesiones y a veces con el nombre escrito de
 * formas distintas; se conserva el más frecuente porque el nombre solo se
 * muestra.
 */
function readOffer(): Pair[] {
  const courses = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'courses.json'), 'utf8'));
  const names = new Map<string, Map<string, number>>();

  for (const course of courses) {
    for (const section of course.sections) {
      for (const session of section.sessions) {
        const teacherEmail = normalizeTeacherEmail(session.email);
        if (!teacherEmail) continue;

        const key = `${course.code} ${teacherEmail}`;
        const tally = names.get(key) ?? new Map<string, number>();
        const name = (session.professor ?? '').trim();
        if (name) tally.set(name, (tally.get(name) ?? 0) + 1);
        names.set(key, tally);
      }
    }
  }

  return [...names.entries()]
    .map(([key, tally]) => {
      const [courseCode, teacherEmail] = key.split(' ');
      const teacherName =
        [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? '';
      return { courseCode, teacherEmail, teacherName };
    })
    .sort((a, b) =>
      a.courseCode.localeCompare(b.courseCode) || a.teacherEmail.localeCompare(b.teacherEmail)
    );
}

/** Pares de la última migración de oferta, para saber cuáles salen. */
function readPreviousOffer(): Set<string> {
  const previous = readdirSync(MIGRATIONS_DIR)
    .filter((file) => /_oferta_\d{4}_\d\.sql$/.test(file))
    .sort()
    .pop();
  if (!previous) return new Set();

  const sql = readFileSync(join(MIGRATIONS_DIR, previous), 'utf8');
  const pairs = new Set<string>();
  for (const [, courseCode, teacherEmail] of sql.matchAll(/^\s*\('([^']+)',\s*'([^']+)',/gm)) {
    pairs.add(`${courseCode} ${teacherEmail}`);
  }
  return pairs;
}

function offerLabel(): string {
  const now = new Date();
  const term = now.getMonth() < 6 ? 1 : 2;
  return `${now.getFullYear()}_${term}`;
}

/**
 * Mayor entre el reloj y el último prefijo + 1: si la última migración lleva
 * fecha posterior a hoy, un prefijo del reloj ordenaría la oferta antes de la
 * migración que crea la tabla.
 */
function timestamp(): string {
  const now = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const last = readdirSync(MIGRATIONS_DIR)
    .map((file) => file.slice(0, 14))
    .filter((prefix) => /^\d{14}$/.test(prefix))
    .sort()
    .pop();
  // 14 dígitos entran de sobra en un Number: 2.03e13 contra 9.01e15 de
  // MAX_SAFE_INTEGER.
  return !last || now > last ? now : String(Number(last) + 1);
}

function render(pairs: Pair[], leaving: number): string {
  const values = pairs
    .map((p) => `  (${quote(p.courseCode)}, ${quote(p.teacherEmail)}, ${quote(p.teacherName)})`)
    .join(',\n');

  const currentPairs = pairs
    .map((p) => `    (${quote(p.courseCode)}, ${quote(p.teacherEmail)})`)
    .join(',\n');

  return `-- Oferta ${offerLabel().replace('_', '-')}: ${pairs.length} pares, ${leaving} salen.
-- GENERADO por \`pnpm generate-offer\`. No editar a mano.

insert into public.course_teachers (course_code, teacher_email, teacher_name) values
${values}
on conflict (course_code, teacher_email) do update
  set teacher_name = excluded.teacher_name,
      is_current   = true;

-- Lo que salió se apaga sin borrarse: las FK de reviews siguen vivas.
update public.course_teachers
set is_current = false
where is_current
  and (course_code, teacher_email) not in (
${currentPairs}
  );
`;
}

function main() {
  const pairs = readOffer();
  const previous = readPreviousOffer();
  const currentKeys = new Set(pairs.map((p) => `${p.courseCode} ${p.teacherEmail}`));

  const entering = pairs.filter((p) => !previous.has(`${p.courseCode} ${p.teacherEmail}`));
  const leaving = [...previous].filter((key) => !currentKeys.has(key));

  if (process.argv.includes('--diff')) {
    console.log(`Oferta actual: ${pairs.length} pares docente–curso.`);
    console.log(`\nEntran (${entering.length}):`);
    for (const p of entering) console.log(`  + ${p.courseCode}  ${p.teacherEmail}  ${p.teacherName}`);
    console.log(`\nSalen (${leaving.length}) — sus reseñas dejan de mostrarse:`);
    for (const key of leaving) console.log(`  - ${key.split(' ').join('  ')}`);
    if (leaving.length) {
      console.log(
        '\nRevísalos: un correo mal parseado se ve igual que un cambio real de docente.'
      );
    }
    return;
  }

  const file = join(MIGRATIONS_DIR, `${timestamp()}_oferta_${offerLabel()}.sql`);
  writeFileSync(file, render(pairs, leaving.length), 'utf8');
  console.log(`${file}\n${pairs.length} pares · entran ${entering.length} · salen ${leaving.length}`);
}

main();
