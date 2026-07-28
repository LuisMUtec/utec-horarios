import { NextResponse } from 'next/server';
import { getActiveCareers, getCareerIdBySlug } from '@/lib/careers';
import { anonymousResponse, requireStudent, resolveStudent } from '@/lib/api-guards';
import {
  saveProfile,
  validateProfileUpdate,
  type ProfileResponse,
  type ProfileWrite,
} from '@/lib/profile';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

/** Sin Supabase no hay cuentas, así que el recurso no existe. */
function notConfigured() {
  return NextResponse.json({ error: 'El perfil no está disponible.' }, { status: 404 });
}

function unavailable() {
  return NextResponse.json(
    { error: 'No se pudo acceder a tu perfil. Inténtalo de nuevo más tarde.' },
    { status: 503 }
  );
}

/**
 * Devuelve carrera y ciclo, o el motivo de la sanción. El sancionado recibe 200
 * y no 403 a propósito: es la consulta que le permite a la interfaz mostrar el
 * mensaje de FR-057 sin tener que provocar un error primero.
 */
export async function GET() {
  if (!isSupabaseConfigured()) return notConfigured();

  try {
    const supabase = await createClient();
    const access = await resolveStudent(supabase);

    if (access.kind === 'anonymous') return anonymousResponse();

    if (access.kind === 'banned') {
      return NextResponse.json({ banned: true, reason: access.reason } satisfies ProfileResponse);
    }

    const { careerSlug, careerName, term } = access.student;

    return NextResponse.json({
      banned: false,
      profile: { careerSlug, careerName, term },
    } satisfies ProfileResponse);
  } catch (error) {
    console.error('Error al consultar el perfil:', error);
    return unavailable();
  }
}

export async function PATCH(request: Request) {
  if (!isSupabaseConfigured()) return notConfigured();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { errors: { form: 'El cuerpo del pedido no es válido.' } },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();
    const guard = await requireStudent(supabase);
    if (!guard.ok) return guard.response;

    const { userId } = guard.student;
    const catalog = await getActiveCareers(supabase);
    const allowed = new Set(catalog.map((career) => career.slug));
    // La carrera que ya tenía cuenta como válida aunque haya dejado de estar
    // vigente: si no, quien la tuviera no podría ni actualizar su ciclo.
    if (guard.student.careerSlug) allowed.add(guard.student.careerSlug);

    const validation = validateProfileUpdate(body, allowed);
    if (!validation.ok) {
      return NextResponse.json({ errors: validation.errors }, { status: 400 });
    }

    const write: ProfileWrite = {};
    let { careerSlug, careerName, term } = guard.student;

    if ('term' in validation.value) {
      term = validation.value.term ?? null;
      write.term = term;
    }

    if ('careerSlug' in validation.value) {
      const slug = validation.value.careerSlug ?? null;

      if (slug === null) {
        write.career_id = null;
        careerSlug = null;
        careerName = null;
      } else {
        const careerId = await getCareerIdBySlug(supabase, slug);
        if (careerId === null) {
          return NextResponse.json(
            { errors: { careerSlug: 'Elige una carrera de la lista.' } },
            { status: 400 }
          );
        }
        write.career_id = careerId;
        careerSlug = slug;
        // Fuera del catálogo vigente no hay nombre nuevo que poner: se conserva
        // el que ya traía el perfil.
        careerName = catalog.find((career) => career.slug === slug)?.name ?? careerName;
      }
    }

    await saveProfile(supabase, userId, write);

    return NextResponse.json({
      banned: false,
      profile: { careerSlug, careerName, term },
    } satisfies ProfileResponse);
  } catch (error) {
    console.error('Error al guardar el perfil:', error);
    return unavailable();
  }
}
