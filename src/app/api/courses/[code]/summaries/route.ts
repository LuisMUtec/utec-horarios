import { NextResponse } from 'next/server';
import { getCourseSummaries } from '@/lib/reviews';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import type { CourseSummariesResponse } from '@/types/reviews';

/** Forma de todos los códigos de src/data/courses.json (AD2003, CS2023). */
const COURSE_CODE = /^[A-Z]{2}\d{4}$/;

/** Público: los resúmenes se leen sin sesión (FR-008). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (!COURSE_CODE.test(code)) {
    return NextResponse.json({ error: 'Código de curso inválido.' }, { status: 400 });
  }

  // Sin Supabase el curso simplemente no tiene resúmenes: un 200 vacío deja la
  // app funcionando como antes de las reseñas (docs/auth.md).
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ summaries: [] } satisfies CourseSummariesResponse);
  }

  try {
    const supabase = await createClient();
    const summaries = await getCourseSummaries(supabase, code);

    return NextResponse.json({ summaries } satisfies CourseSummariesResponse);
  } catch (error) {
    console.error('Error al consultar los resúmenes del curso:', error);

    return NextResponse.json(
      { error: 'No se pudieron cargar los resúmenes. Inténtalo de nuevo más tarde.' },
      { status: 503 }
    );
  }
}
