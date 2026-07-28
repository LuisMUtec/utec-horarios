import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getClientKey, isRateLimited, type RateLimitEntry } from '@/lib/rate-limit';
import { updateSession } from '@/lib/supabase/proxy';

const rateLimitStore = new Map<string, RateLimitEntry>();

/** Devuelve un 429 si corresponde, o null para dejar seguir el request. */
function rateLimit(request: NextRequest): NextResponse | null {
  // El límite es solo para /api; las páginas no lo consumen.
  if (!request.nextUrl.pathname.startsWith('/api')) return null;

  if (!isRateLimited(rateLimitStore, getClientKey(request.headers), Date.now())) {
    return null;
  }

  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { status: 429 }
  );
}

export async function proxy(request: NextRequest) {
  const limited = rateLimit(request);
  if (limited) return limited;

  return updateSession(request);
}

export const config = {
  // Todo menos estáticos: el refresco de sesión tiene que correr también en las
  // páginas, no solo en /api.
  matcher: '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
};
