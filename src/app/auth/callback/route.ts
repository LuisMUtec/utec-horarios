import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ALLOWED_EMAIL_DOMAIN, isAllowedEmail } from '@/lib/auth-domain';
import { requestOrigin } from '@/lib/request-origin';

const DOMAIN_ERROR = `Solo se permiten cuentas @${ALLOWED_EMAIL_DOMAIN}.`;

export async function GET(request: NextRequest) {
  const origin = requestOrigin(request);
  const params = request.nextUrl.searchParams;

  const errorFail = (message: string) =>
    NextResponse.redirect(`${origin}/auth/error?error=${encodeURIComponent(message)}`);

  // Así llega el rechazo del hook de signup y también el "cancelar" de Google.
  if (params.get('error')) {
    return errorFail(params.get('error_description') ?? DOMAIN_ERROR);
  }

  const code = params.get('code');
  if (!code) return errorFail('Falta el código de autorización.');

  const supabase = await createClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return errorFail('No se pudo completar el inicio de sesión.');

  // Segunda línea de defensa: el hook solo corre al crear el usuario, así que
  // no cubre a alguien que ya existiera con otro correo.
  const { data } = await supabase.auth.getClaims();
  if (!isAllowedEmail(data?.claims.email)) {
    await supabase.auth.signOut();
    return errorFail(DOMAIN_ERROR);
  }

  // Sin el `code` en la URL: queda en el historial y en el Referer.
  return NextResponse.redirect(origin);
}
