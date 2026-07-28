// Genera src/data/courses.json desde el export xlsx de "Consulta de Horarios".
//
//   node scripts/parse-xlsx.mjs <ruta-al-xlsx>
//
// El xlsx NO se commitea: trae el nombre, la carrera y el turno de matrícula
// del alumno que lo descargó, y este repo es público. Cada quien baja el suyo
// del portal y lo pasa por acá; la tabla es la misma para todos.
//
// Reemplaza a `pnpm parse-pdf` como fuente de courses.json. El PDF ordenaba las
// celdas por posición en la página, y eso partía correos y nombres de curso al
// envolverse el texto ("...@utec.edu. pe", "Telecomunicacione s"). El xlsx trae
// una fila por sesión y una columna por campo, así que no hay nada que adivinar.
//
// Se mantiene el volcado crudo (D5): lo único que se toca es el trim de cada
// celda. Los nombres de docente que vienen en MAYÚSCULAS se dejan así porque
// también salían en mayúsculas del PDF — es la fuente, no el formato.

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = join(ROOT, 'src', 'data', 'courses.json');

const DAY_MAP = {
  Lun: 'Lun', Mar: 'Mar', Mie: 'Mie', 'Mié': 'Mie',
  Jue: 'Jue', Vie: 'Vie', Sab: 'Sab', 'Sáb': 'Sab',
};

/** Encabezados de la tabla, en el orden en que salen del portal. */
const HEADERS = [
  'Código Curso', 'Curso', 'Sección', 'Sesión Grupo', 'Modalidad', 'Horario',
  'Frecuencia', 'Ubicación', 'Vacantes', 'Matriculados', 'Docente', 'Correo',
];

const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

function unescapeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    // El & va al final: si no, un "&amp;lt;" se decodificaría dos veces.
    .replace(/&amp;/g, '&');
}

/** Un xlsx es un zip; se leen las dos entradas que importan sin dependencias. */
function readEntry(xlsxPath, entry) {
  return execFileSync('unzip', ['-p', xlsxPath, entry], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

/**
 * La tabla de strings compartidos. Una celda de texto guarda un índice acá en
 * vez del texto; un mismo `<si>` puede venir partido en varios `<t>` cuando el
 * portal le aplica formato a un pedazo.
 */
function readSharedStrings(xlsxPath) {
  const xml = readEntry(xlsxPath, 'xl/sharedStrings.xml');
  const strings = [];
  for (const [, item] of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    let text = '';
    for (const [, run] of item.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) text += unescapeXml(run);
    strings.push(text);
  }
  return strings;
}

function readRows(xlsxPath, shared) {
  const xml = readEntry(xlsxPath, 'xl/worksheets/sheet1.xml');
  const rows = [];

  for (const [, index, body] of xml.matchAll(/<row [^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const [, column, attrs, content] of body.matchAll(
      /<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g
    )) {
      const value = content.match(/<v>([\s\S]*?)<\/v>/);
      let text = '';
      if (/t="s"/.test(attrs)) {
        // Celda de texto: <v> es el índice en sharedStrings.
        text = value ? (shared[Number(value[1])] ?? '') : '';
      } else if (/t="(inlineStr|str)"/.test(attrs)) {
        const inline = content.match(/<t[^>]*>([\s\S]*?)<\/t>/);
        text = inline ? unescapeXml(inline[1]) : value ? unescapeXml(value[1]) : '';
      } else if (value) {
        text = unescapeXml(value[1]);
      }
      cells[column] = text.trim();
    }
    rows.push({ index: Number(index), cells });
  }

  return rows;
}

/**
 * La tabla no empieza en la fila 1: arriba va la cabecera con los datos del
 * alumno, y su alto varía. Se ancla en la fila de encabezados.
 */
function tableRows(rows) {
  const header = rows.find((row) => row.cells.A === HEADERS[0]);
  if (!header) throw new Error(`No se encontró la fila de encabezados ("${HEADERS[0]}").`);

  const actual = COLUMNS.map((column) => header.cells[column] ?? '');
  if (actual.join('|') !== HEADERS.join('|')) {
    throw new Error(
      `Las columnas del xlsx cambiaron.\n  esperado: ${HEADERS.join(' | ')}\n  recibido: ${actual.join(' | ')}`
    );
  }

  return rows.filter((row) => row.index > header.index && row.cells.A);
}

function parseRow(row) {
  const [code, name, section, type, modality, horario, frequency, location, capacity, enrolled, professor, email] =
    COLUMNS.map((column) => row.cells[column] ?? '');

  const schedule = horario.match(
    /(Lun|Mar|Mie|Mié|Jue|Vie|Sab|Sáb)\.?\s*(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/
  );
  if (!schedule) throw new Error(`Fila ${row.index} (${code}): no se pudo leer el horario "${horario}".`);

  return {
    code,
    name,
    section: Number.parseInt(section, 10),
    session: {
      type,
      modality,
      day: DAY_MAP[schedule[1]] ?? schedule[1],
      startTime: schedule[2],
      endTime: schedule[3],
      frequency,
      location,
      capacity: Number.parseInt(capacity, 10) || 0,
      enrolled: Number.parseInt(enrolled, 10) || 0,
      professor,
      email,
    },
  };
}

export function parseXlsx(xlsxPath) {
  const shared = readSharedStrings(xlsxPath);
  const rows = tableRows(readRows(xlsxPath, shared));

  const byCode = new Map();
  for (const row of rows) {
    const { code, name, section, session } = parseRow(row);

    if (!byCode.has(code)) byCode.set(code, { code, name, sections: new Map() });
    const course = byCode.get(code);
    // Mismo criterio que traía el parser del PDF: gana el nombre más largo.
    if (name.length > course.name.length) course.name = name;

    if (!course.sections.has(section)) course.sections.set(section, { number: section, sessions: [] });
    course.sections.get(section).sessions.push(session);
  }

  return [...byCode.values()]
    .map((course) => ({
      code: course.code,
      name: course.name,
      sections: [...course.sections.values()].sort((a, b) => a.number - b.number),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

function main() {
  const xlsxPath = process.argv[2];
  if (!xlsxPath) {
    console.error('Uso: node scripts/parse-xlsx.mjs <ruta-al-xlsx>');
    process.exit(1);
  }

  const courses = parseXlsx(xlsxPath);
  // Sin salto final, igual que lo dejaba el parser del PDF: así el diff del
  // archivo generado no arrastra un cambio que no es de datos.
  writeFileSync(OUTPUT_PATH, JSON.stringify(courses, null, 2), 'utf8');

  const sections = courses.reduce((total, course) => total + course.sections.length, 0);
  const sessions = courses.reduce(
    (total, course) => total + course.sections.reduce((sum, section) => sum + section.sessions.length, 0),
    0
  );
  console.log(`${OUTPUT_PATH}`);
  console.log(`${courses.length} cursos · ${sections} secciones · ${sessions} sesiones`);
  console.log('Ahora corre `pnpm diff-oferta` y, si el diff cuadra, `pnpm generate-offer`.');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
