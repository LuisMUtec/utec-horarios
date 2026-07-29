import { NextResponse } from 'next/server';
import { getActiveCareers, type CareersResponse } from '@/lib/careers';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

/** Público: el catálogo no dice nada de nadie y el selector lo necesita antes
 *  de que exista sesión. */
export async function GET() {
  // Mismo trato que los resúmenes: sin Supabase el catálogo está vacío y la
  // app sigue funcionando como antes de las reseñas (docs/auth.md).
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ careers: [] } satisfies CareersResponse);
  }

  try {
    const supabase = await createClient();
    const careers = await getActiveCareers(supabase);

    return NextResponse.json({ careers } satisfies CareersResponse);
  } catch (error) {
    console.error('Error al consultar el catálogo de carreras:', error);

    return NextResponse.json(
      { error: 'No se pudo cargar el catálogo de carreras. Inténtalo de nuevo más tarde.' },
      { status: 503 }
    );
  }
}
