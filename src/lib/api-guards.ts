/**
 * Guard compartido por los handlers restringidos (FR-013, FR-057).
 *
 * RLS ya impide que un sancionado escriba, pero su rechazo es un fallo genérico
 * y FR-057 exige decirle que el acceso fue retirado y por qué. Eso solo puede
 * salir de leer `profiles`, así que el guard lo hace antes de tocar nada.
 */

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export type GuardClient = SupabaseClient<Database>;

export interface Student {
  userId: string;
  careerSlug: string | null;
  careerName: string | null;
  term: number | null;
}

export type StudentAccess =
  | { kind: 'anonymous' }
  | { kind: 'banned'; userId: string; reason: string }
  | { kind: 'student'; student: Student };

const PROFILE_COLUMNS = 'banned_at, ban_reason, term, careers(slug, name)';

interface CareerRef {
  slug: string;
  name: string;
}

interface ProfileRow {
  banned_at: string | null;
  ban_reason: string | null;
  term: number | null;
  careers: CareerRef | CareerRef[] | null;
}

/**
 * PostgREST devuelve un objeto para la relación a-uno, pero los tipos generados
 * la declaran `isOneToOne: false` y hay versiones que la tipan como arreglo.
 * Normalizar las dos formas cuesta menos que un cast que puede quedar mintiendo.
 */
function firstCareer(value: ProfileRow['careers']): CareerRef | null {
  if (value === null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Quién pide, sin decidir todavía qué responder: `/api/profile` necesita
 * devolverle 200 al sancionado con su motivo, y los demás handlers cortarle.
 */
export async function resolveStudent(client: GuardClient): Promise<StudentAccess> {
  // `getClaims()` y nunca `getSession()`: la cookie la escribe el navegador y
  // solo la primera verifica la firma del token.
  const { data: auth, error: authError } = await client.auth.getClaims();
  const userId = auth?.claims?.sub;

  if (authError || typeof userId !== 'string') return { kind: 'anonymous' };

  const { data, error } = await client
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .single();

  // Sin fila hay una inconsistencia real —`handle_new_user` la crea al firmar—,
  // y dejar pasar a alguien sin perfil haría que los updates no afectaran nada
  // en silencio.
  if (error) throw new Error(`No se pudo leer el perfil: ${error.message}`);

  const row = data as unknown as ProfileRow;

  if (row.banned_at !== null) {
    // `ban_has_reason` garantiza el motivo cuando hay sanción: el `??` está por
    // el tipo, no por un caso alcanzable.
    return { kind: 'banned', userId, reason: row.ban_reason ?? '' };
  }

  const career = firstCareer(row.careers);

  return {
    kind: 'student',
    student: {
      userId,
      careerSlug: career?.slug ?? null,
      careerName: career?.name ?? null,
      term: row.term,
    },
  };
}

export const ANONYMOUS_MESSAGE = 'Inicia sesión con tu cuenta UTEC para continuar.';
export const BANNED_MESSAGE = 'Tu acceso a las reseñas fue retirado de forma permanente.';

export function anonymousResponse(): NextResponse {
  return NextResponse.json({ error: ANONYMOUS_MESSAGE }, { status: 401 });
}

/** `banned` y `reason` viajan aparte del mensaje para que la UI pueda componer
 *  el suyo sin parsear texto (FR-057). */
export function bannedResponse(reason: string): NextResponse {
  return NextResponse.json(
    { error: BANNED_MESSAGE, banned: true, reason },
    { status: 403 }
  );
}

export type Guarded =
  | { ok: true; student: Student }
  | { ok: false; response: NextResponse };

/** Lo que usan los handlers: `if (!guard.ok) return guard.response;`. */
export async function requireStudent(client: GuardClient): Promise<Guarded> {
  const access = await resolveStudent(client);

  if (access.kind === 'anonymous') return { ok: false, response: anonymousResponse() };
  if (access.kind === 'banned') return { ok: false, response: bannedResponse(access.reason) };

  return { ok: true, student: access.student };
}
