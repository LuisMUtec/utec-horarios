import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ALLOWED_EMAIL_DOMAIN } from '@/lib/auth-domain';
import { requestOrigin } from '@/lib/request-origin';

export async function GET(request: NextRequest) {
  const origin = requestOrigin(request);
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
      // `hd` hace que Google ya solo ofrezca cuentas del dominio. Es comodidad,
      // no seguridad: el navegador puede quitarlo, por eso además valida el
      // hook de signup y el callback.
      queryParams: { hd: ALLOWED_EMAIL_DOMAIN },
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(
      `${origin}/auth/error?error=${encodeURIComponent('No se pudo iniciar sesión con Google.')}`
    );
  }

  return NextResponse.redirect(data.url);
}
