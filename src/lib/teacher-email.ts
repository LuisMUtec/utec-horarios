/**
 * Normalización del correo del docente, que es su identidad (FR-053).
 *
 * El campo que sale del PDF viene sucio de dos formas, que además se combinan:
 * la capacidad pegada al final ("pperezq@utec.edu.pe 44") y un espacio dentro
 * del dominio por el salto de línea ("rcondorena@utec.edu. pe").
 *
 * Se normaliza al leer, no al parsear: src/data/courses.json sigue siendo el
 * volcado crudo del PDF (D5).
 */

const UTEC_DOMAIN = 'utec.edu.pe';

const VALID_EMAIL = /^[a-z0-9._-]+@utec\.edu\.pe$/;

/** `null` es el estado `Docente por asignar` de FR-054, no un error. */
export function normalizeTeacherEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const cleaned = raw
    .trim()
    // Primero la capacidad: va separada por espacio y el dominio nunca termina
    // en dígitos, así que quitarla acá es inequívoco. Después de colapsar los
    // espacios ya no se distinguiría del correo.
    .replace(/\s+\d+$/, '')
    .replace(/\s+/g, '')
    .toLowerCase();

  return VALID_EMAIL.test(cleaned) ? cleaned : null;
}

/** Llave del par docente–curso, la unidad sobre la que se agregan (FR-001). */
export function teacherPairKey(courseCode: string, teacherEmail: string): string {
  return `${courseCode.trim().toUpperCase()}|${teacherEmail.trim().toLowerCase()}`;
}

export { UTEC_DOMAIN };
