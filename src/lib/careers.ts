/**
 * Catálogo de carreras: tipos, consulta y agrupado para el selector (FR-017).
 *
 * El dato vive en la tabla `careers` y su origen documentado es
 * specs/002-resenas-docentes/carreras-utec.md. Acá no hay una tercera copia de
 * la lista a propósito: tests/careers.test.ts vigila que la migración y el
 * documento no se separen, y una constante en TypeScript sería un tercer frente.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/** `slug` es la llave estable; `name` cambia si UTEC renombra la carrera. */
export interface Career {
  slug: string;
  name: string;
  faculty: string;
}

export interface CareersResponse {
  careers: Career[];
}

/** La facultad agrupa visualmente el selector y no se guarda con la reseña. */
export interface FacultyGroup {
  faculty: string;
  careers: Career[];
}

export type CareersClient = SupabaseClient<Database>;

/** Lista explícita, no `*`: `id` no tiene por qué llegar al navegador. */
const CAREER_COLUMNS = 'slug, name, faculty';

const byName = (a: Career, b: Career) => a.name.localeCompare(b.name, 'es');

/**
 * Solo las vigentes. La política de `careers` no filtra `is_active` porque un
 * perfil que apunta a una carrera dada de baja tiene que seguir resolviendo su
 * nombre; acotar el selector es tarea de esta consulta.
 */
export async function getActiveCareers(client: CareersClient): Promise<Career[]> {
  const { data, error } = await client
    .from('careers')
    .select(CAREER_COLUMNS)
    .eq('is_active', true);

  if (error) {
    throw new Error(`No se pudo cargar el catálogo de carreras: ${error.message}`);
  }

  return ((data ?? []) as Career[]).map(({ slug, name, faculty }) => ({ slug, name, faculty }));
}

/**
 * El `id` de una carrera por su slug, que es lo que escribe `profiles.career_id`.
 * Sin filtrar `is_active`: quien ya tenía una carrera dada de baja tiene que
 * poder volver a guardarla, o no podría actualizar su ciclo nunca más.
 */
export async function getCareerIdBySlug(
  client: CareersClient,
  slug: string
): Promise<string | null> {
  const { data, error } = await client
    .from('careers')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo resolver la carrera ${slug}: ${error.message}`);
  }

  return data?.id ?? null;
}

/**
 * Agrupa por facultad para el `optgroup` del selector.
 *
 * El orden es alfabético en lugar de una lista de facultades escrita acá:
 * cualquier otro criterio obligaría a mantener un segundo listado que se
 * separaría del catálogo en cuanto UTEC abra o cierre una facultad.
 */
export function groupByFaculty(careers: Career[]): FacultyGroup[] {
  const byFaculty = new Map<string, Career[]>();

  for (const career of careers) {
    const group = byFaculty.get(career.faculty);
    if (group) group.push(career);
    else byFaculty.set(career.faculty, [career]);
  }

  return [...byFaculty]
    .map(([faculty, group]) => ({ faculty, careers: [...group].sort(byName) }))
    .sort((a, b) => a.faculty.localeCompare(b.faculty, 'es'));
}

/**
 * La carrera que el estudiante ya tenía cuando dejó de estar vigente, para que
 * el selector la siga ofreciendo. Sin esto desaparecería de la vista y el
 * primer guardado la perdería sin que nadie lo pidiera.
 *
 * Va suelta y no dentro de una facultad porque el perfil guarda el `slug`, no
 * la facultad: inventarle una sería mostrar un dato que no tenemos.
 */
export function outdatedOption(
  catalog: Career[],
  profile: { careerSlug: string | null; careerName: string | null }
): { slug: string; name: string } | null {
  const { careerSlug, careerName } = profile;
  if (!careerSlug || catalog.some((career) => career.slug === careerSlug)) return null;

  return { slug: careerSlug, name: careerName ?? careerSlug };
}
