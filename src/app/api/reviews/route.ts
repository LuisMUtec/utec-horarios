import { NextResponse } from 'next/server';
import { requireStudent } from '@/lib/api-guards';
import { getCourseTeacherId, getOwnReview, getPairComments } from '@/lib/reviews';
import { normalizeTeacherEmail } from '@/lib/teacher-email';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import type { PairReviewsResponse } from '@/types/reviews';

/** Misma forma que los códigos de src/data/courses.json. */
const COURSE_CODE = /^[A-Z]{2}\d{4}$/;

/**
 * Los comentarios de un par docente–curso. Exige sesión (FR-013), y el 401 sin
 * ella es lo que dispara la invitación a iniciar sesión del escenario 8.
 */
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Las reseñas no están disponibles.' }, { status: 404 });
  }

  const params = new URL(request.url).searchParams;
  const course = (params.get('course') ?? '').trim().toUpperCase();
  // El mismo normalizador que arma la llave en la UI: si acá se aceptara el
  // correo crudo, el par no resolvería y la lista saldría vacía sin explicación.
  const teacher = normalizeTeacherEmail(params.get('teacher'));

  if (!COURSE_CODE.test(course) || teacher === null) {
    return NextResponse.json({ error: 'Curso o docente inválido.' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const guard = await requireStudent(supabase);
    if (!guard.ok) return guard.response;

    // `course_teachers` solo deja ver los pares vigentes, así que un par que
    // salió de la oferta llega acá como inexistente (R6).
    const courseTeacherId = await getCourseTeacherId(supabase, course, teacher);
    if (courseTeacherId === null) {
      return NextResponse.json({ error: 'Ese docente no dicta ese curso.' }, { status: 404 });
    }

    const [comments, own] = await Promise.all([
      getPairComments(supabase, course, teacher),
      getOwnReview(supabase, courseTeacherId),
    ]);

    return NextResponse.json({
      courseTeacherId,
      comments,
      own,
    } satisfies PairReviewsResponse);
  } catch (error) {
    console.error('Error al consultar las reseñas del par:', error);

    return NextResponse.json(
      { error: 'No se pudieron cargar las reseñas. Inténtalo de nuevo más tarde.' },
      { status: 503 }
    );
  }
}
