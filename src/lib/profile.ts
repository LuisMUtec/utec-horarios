/**
 * Carrera y ciclo del estudiante: validación y escritura (FR-017, FR-018).
 *
 * La validación la comparten el formulario y el route handler. La del handler
 * es la que cuenta; la del formulario existe para no hacer viajar un error
 * evitable.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const TERM_MIN = 1;
export const TERM_MAX = 10;

/** Lo que el estudiante ve y edita de su perfil. Nada de esto es público (FR-019). */
export interface Profile {
  careerSlug: string | null;
  careerName: string | null;
  term: number | null;
}

/**
 * La respuesta de `/api/profile`. Es una unión y no un objeto plano para que
 * mostrar el motivo de FR-057 no sea opcional para quien la consuma.
 */
export type ProfileResponse =
  | { banned: false; profile: Profile }
  | { banned: true; reason: string };

/** Ausente = no se toca. `null` = se limpia. Ambos campos son opcionales (FR-016). */
export interface ProfileUpdate {
  careerSlug?: string | null;
  term?: number | null;
}

export type ProfileErrors = {
  careerSlug?: string;
  term?: string;
  /** Lo que no es de un campo concreto: cuerpo inválido, nada que cambiar. */
  form?: string;
};

export type ProfileValidation =
  | { ok: true; value: ProfileUpdate }
  | { ok: false; errors: ProfileErrors };

/** FR-017: el umbral para escribir un comentario, no para leerlo. */
export function isProfileComplete(profile: Profile): boolean {
  return profile.careerSlug !== null && profile.term !== null;
}

/** Lo que tiene el formulario en pantalla. Todo texto: sale de dos `<select>`. */
export interface ProfileDraft {
  careerSlug: string;
  term: string;
}

export function profileDraft(profile: Profile): ProfileDraft {
  return {
    careerSlug: profile.careerSlug ?? '',
    term: profile.term === null ? '' : String(profile.term),
  };
}

/**
 * Solo lo que cambió. Mandar siempre los dos campos haría que corregir el ciclo
 * reescribiera la carrera, y con ella la validación contra un catálogo que pudo
 * haberla dado de baja mientras la página estaba abierta.
 */
export function profileDiff(saved: Profile, draft: ProfileDraft): ProfileUpdate {
  const current = profileDraft(saved);
  const update: ProfileUpdate = {};

  if (current.careerSlug !== draft.careerSlug) {
    update.careerSlug = draft.careerSlug === '' ? null : draft.careerSlug;
  }

  if (current.term !== draft.term) {
    update.term = draft.term === '' ? null : Number(draft.term);
  }

  return update;
}

/** Un `<select>` sin elegir manda cadena vacía; para el perfil es «sin dato». */
function isCleared(value: unknown): boolean {
  return value === null || value === '';
}

/**
 * El ciclo llega como número desde el handler y como texto desde un `<select>`.
 * Se aceptan ambos, pero solo si el texto son dígitos: así `"5.5"` y `" 5"`
 * fallan con un mensaje en vez de colarse redondeados.
 */
function parseTerm(value: unknown): number | null {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return null;
}

export function validateProfileUpdate(
  raw: unknown,
  allowedSlugs: Iterable<string>
): ProfileValidation {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: { form: 'El cuerpo del pedido no es válido.' } };
  }

  const body = raw as Record<string, unknown>;
  const errors: ProfileErrors = {};
  const value: ProfileUpdate = {};

  if ('careerSlug' in body) {
    const slug = body.careerSlug;
    if (isCleared(slug)) {
      value.careerSlug = null;
    } else if (typeof slug === 'string' && new Set(allowedSlugs).has(slug)) {
      value.careerSlug = slug;
    } else {
      errors.careerSlug = 'Elige una carrera de la lista.';
    }
  }

  if ('term' in body) {
    const term = body.term;
    if (isCleared(term)) {
      value.term = null;
    } else {
      const parsed = parseTerm(term);
      if (parsed === null) {
        errors.term = 'El ciclo debe ser un número entero.';
      } else if (parsed < TERM_MIN || parsed > TERM_MAX) {
        errors.term = `El ciclo va del ${TERM_MIN} al ${TERM_MAX}.`;
      } else {
        value.term = parsed;
      }
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (Object.keys(value).length === 0) {
    return { ok: false, errors: { form: 'No hay nada que actualizar.' } };
  }

  return { ok: true, value };
}

export type ProfileClient = SupabaseClient<Database>;

/** Lo que ya viene traducido de slug a `career_id`, listo para la tabla. */
export interface ProfileWrite {
  career_id?: string | null;
  term?: number | null;
}

/**
 * Escribe solo las columnas presentes. Las dos que RLS concede por columna son
 * exactamente estas: cualquier otra la rechaza Postgres, no una comprobación de
 * acá.
 */
export async function saveProfile(
  client: ProfileClient,
  userId: string,
  write: ProfileWrite
): Promise<void> {
  // El `select` no es para leer: un update que RLS filtra no devuelve error,
  // devuelve cero filas, y sin esto el handler respondería «guardado».
  const { data, error } = await client
    .from('profiles')
    .update(write)
    .eq('id', userId)
    .select('id');

  if (error) {
    throw new Error(`No se pudo guardar el perfil: ${error.message}`);
  }

  if ((data ?? []).length === 0) {
    throw new Error('No se pudo guardar el perfil: la fila no era alcanzable.');
  }
}
