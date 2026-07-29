import { NextResponse } from 'next/server';
import { requireStudent } from '@/lib/api-guards';
import { createReview, getCourseTeacherId, getOwnReview, getPairComments } from '@/lib/reviews';
import { validateReviewSubmission } from '@/lib/review-submit';
import { normalizeTeacherEmail } from '@/lib/teacher-email';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import type { PairReviewsResponse, PublishedReviewResponse } from '@/types/reviews';
import { getPostHogClient } from '@/lib/posthog-server';

/** Misma forma que los códigos de src/data/courses.json. */
const COURSE_CODE = /^[A-Z]{2}\d{4}$/;

function notConfigured() {
  return NextResponse.json({ error: 'Las reseñas no están disponibles.' }, { status: 404 });
}

/** El par que la UI mandó no existe o salió de la oferta (FR-028, R6). */
function pairNotFound() {
  return NextResponse.json(
    { error: 'Ese docente ya no dicta este curso.', code: 'not_current' },
    { status: 404 }
  );
}

/** Curso y docente llegan del resumen, no de un campo editable (FR-028). */
function readPair(course: unknown, teacher: unknown) {
  const code = typeof course === 'string' ? course.trim().toUpperCase() : '';
  // El mismo normalizador que arma la llave en la UI: si acá se aceptara el
  // correo crudo, el par no resolvería y la lista saldría vacía sin explicación.
  const email = normalizeTeacherEmail(typeof teacher === 'string' ? teacher : null);

  return COURSE_CODE.test(code) && email !== null ? { code, email } : null;
}

/**
 * Los comentarios de un par docente–curso. Exige sesión (FR-013), y el 401 sin
 * ella es lo que dispara la invitación a iniciar sesión del escenario 8.
 */
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) return notConfigured();

  const params = new URL(request.url).searchParams;
  const pair = readPair(params.get('course'), params.get('teacher'));

  if (pair === null) {
    return NextResponse.json({ error: 'Curso o docente inválido.' }, { status: 400 });
  }

  const { code: course, email: teacher } = pair;

  try {
    const supabase = await createClient();
    const guard = await requireStudent(supabase);
    if (!guard.ok) return guard.response;

    // `course_teachers` solo deja ver los pares vigentes, así que un par que
    // salió de la oferta llega acá como inexistente (R6).
    const courseTeacherId = await getCourseTeacherId(supabase, course, teacher);
    if (courseTeacherId === null) return pairNotFound();

    const [comments, own] = await Promise.all([
      getPairComments(supabase, course, teacher),
      getOwnReview(supabase, courseTeacherId),
    ]);

    try {
      const ph = getPostHogClient();
      ph.capture({
        distinctId: guard.student.userId,
        event: 'reviews_viewed',
        properties: {
          course_code: course,
          comment_count: comments.length,
        },
      });
      await ph.flush();
    } catch { /* PostHog no debe bloquear la respuesta */ }

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

/**
 * Publica una puntuación con su recomendación (FR-021, FR-061). Sin comentario:
 * esta contribución no exige carrera, ciclo ni compromiso de respeto (SC-003).
 *
 * Ninguna de las reglas se decide acá. La unicidad del par, el límite de 24
 * horas y el par vigente los imponen el índice y los triggers; este handler
 * traduce su rechazo a algo que la interfaz pueda mostrar y distinguir.
 */
export async function POST(request: Request) {
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

  const fields = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const pair = readPair(fields.course, fields.teacher);

  if (pair === null) {
    return NextResponse.json(
      { errors: { form: 'Curso o docente inválido.' } },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();
    // Antes de validar campos: a quien perdió la sesión mientras escribía hay
    // que decirle eso y no que le falta marcar una casilla (edge case
    // *Pérdida de sesión durante la publicación*).
    const guard = await requireStudent(supabase);
    if (!guard.ok) return guard.response;

    const validation = validateReviewSubmission(body);
    if (!validation.ok) {
      return NextResponse.json({ errors: validation.errors }, { status: 400 });
    }

    const courseTeacherId = await getCourseTeacherId(supabase, pair.code, pair.email);
    if (courseTeacherId === null) return pairNotFound();

    const result = await createReview(
      supabase,
      guard.student.userId,
      courseTeacherId,
      validation.value
    );

    if (result.ok) {
      return NextResponse.json({ review: result.review } satisfies PublishedReviewResponse, {
        status: 201,
      });
    }

    const { rejection } = result;

    // FR-027: no es un fallo del estudiante, es que ya contribuyó. Se le
    // devuelve su reseña para que vea qué publicó; editarla llega con US5.
    if (rejection.code === 'duplicate') {
      const own = await getOwnReview(supabase, courseTeacherId);

      return NextResponse.json(
        { error: rejection.message, code: rejection.code, own },
        { status: 409 }
      );
    }

    // FR-030 y FR-031. El 429 es el estado de «vuelve más tarde», y `releaseAt`
    // es lo que deja que el texto lo arme `review-format.ts` y no este handler.
    if (rejection.code === 'rate_limit') {
      return NextResponse.json(
        { error: rejection.message, code: rejection.code, releaseAt: rejection.releaseAt },
        { status: 429 }
      );
    }

    return pairNotFound();
  } catch (error) {
    console.error('Error al publicar la reseña:', error);

    return NextResponse.json(
      { errors: { form: 'No se pudo publicar la reseña. Inténtalo de nuevo más tarde.' } },
      { status: 503 }
    );
  }
}
