import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import coursesData from '@/data/courses.json';

/**
 * Golden test del parser.
 *
 * Parsea consulta_horario.pdf y lo compara contra el courses.json commiteado.
 * Si fallan, o el PDF cambió sin regenerar los datos, o una actualización de
 * pdfjs-dist alteró la extracción (justo pasó: 4.0.379 -> 4.10.38 entró sola
 * dentro del rango ^4).
 *
 * parse-pdf.js solo escribe a disco cuando corre como CLI; importarlo devuelve
 * los cursos sin tocar courses.json.
 */

const require = createRequire(import.meta.url);
const { parsePDF } = require('../scripts/parse-pdf.js');

let parsed: unknown;

beforeAll(async () => {
  // parsePDF loguea un resumen y una muestra de cursos; no ensuciar el output.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  parsed = await parsePDF();
}, 60_000);

afterAll(() => {
  vi.restoreAllMocks();
});

describe('parse-pdf', () => {
  it('reproduce exactamente el courses.json commiteado', () => {
    expect(parsed).toEqual(coursesData);
  });

  it('el JSON serializado es idéntico byte a byte', () => {
    // toEqual ignora el orden de claves; el archivo en disco no.
    expect(JSON.stringify(parsed, null, 2)).toBe(JSON.stringify(coursesData, null, 2));
  });
});
