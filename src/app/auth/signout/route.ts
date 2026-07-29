import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requestOrigin } from '@/lib/request-origin';
import { getPostHogClient } from '@/lib/posthog-server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims as { sub?: string } | undefined;
    if (claims?.sub) {
      const ph = getPostHogClient();
      ph.capture({ distinctId: claims.sub, event: 'logout_completed' });
      await ph.flush();
    }
  } catch { /* PostHog no debe bloquear el cierre de sesión */ }

  await supabase.auth.signOut();

  // 303: el navegador tiene que seguir con GET, no repetir el POST.
  return NextResponse.redirect(requestOrigin(request), { status: 303 });
}
