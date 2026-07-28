import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requestOrigin } from '@/lib/request-origin';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // 303: el navegador tiene que seguir con GET, no repetir el POST.
  return NextResponse.redirect(requestOrigin(request), { status: 303 });
}
