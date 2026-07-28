import type { NextRequest } from 'next/server';

/**
 * Origen público del request.
 *
 * Detrás del proxy de Vercel `nextUrl.origin` es el host interno, así que las
 * URLs de redirección de OAuth saldrían mal. Los headers reenviados mandan.
 */
export function requestOrigin(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host');
  if (!host) return request.nextUrl.origin;

  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  return `${proto}://${host}`;
}
