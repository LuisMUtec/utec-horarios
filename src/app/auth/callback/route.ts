import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ALLOWED_EMAIL_DOMAIN, isAllowedEmail } from '@/lib/auth-domain';
import { requestOrigin } from '@/lib/request-origin';
import { getPostHogClient } from '@/lib/posthog-server';

const DOMAIN_ERROR = `Solo se permiten cuentas @${ALLOWED_EMAIL_DOMAIN}.`;

export async function GET(request: NextRequest) {
  const origin = requestOrigin(request);
  const params = request.nextUrl.searchParams;

  const errorFail = (message: string) =>
    NextResponse.redirect(`${origin}/auth/error?error=${encodeURIComponent(message)}`);

  // Así llega el rechazo del hook de signup y también el "cancelar" de Google.
  if (params.get('error')) {
    try {
      const ph = getPostHogClient();
      ph.capture({ distinctId: 'anonymous', event: 'login_failed', properties: { reason: 'oauth_error' } });
      await ph.flush();
    } catch { /* PostHog no debe bloquear el flujo de auth */ }
    return errorFail(params.get('error_description') ?? DOMAIN_ERROR);
  }

  const code = params.get('code');
  if (!code) return errorFail('Falta el código de autorización.');

  const supabase = await createClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    try {
      const ph = getPostHogClient();
      ph.capture({ distinctId: 'anonymous', event: 'login_failed', properties: { reason: 'exchange_error' } });
      await ph.flush();
    } catch { /* PostHog no debe bloquear el flujo de auth */ }
    return errorFail('No se pudo completar el inicio de sesión.');
  }

  // Segunda línea de defensa: el hook solo corre al crear el usuario, así que
  // no cubre a alguien que ya existiera con otro correo.
  const { data } = await supabase.auth.getClaims();
  if (!isAllowedEmail(data?.claims.email)) {
    await supabase.auth.signOut();
    try {
      const ph = getPostHogClient();
      ph.capture({ distinctId: 'anonymous', event: 'login_failed', properties: { reason: 'domain_not_allowed' } });
      await ph.flush();
    } catch { /* PostHog no debe bloquear el flujo de auth */ }
    return errorFail(DOMAIN_ERROR);
  }

  // Identificar al usuario en el lado servidor tras el login exitoso.
  try {
    const claims = data?.claims as { sub?: string; email?: string } | undefined;
    if (claims?.sub) {
      const ph = getPostHogClient();
      ph.identify({ distinctId: claims.sub, properties: { email: claims.email } });
      ph.capture({ distinctId: claims.sub, event: 'login_completed' });
      await ph.flush();
    }
  } catch { /* PostHog no debe bloquear el flujo de auth */ }

  // Sin el `code` en la URL: queda en el historial y en el Referer.
  return NextResponse.redirect(origin);
}
