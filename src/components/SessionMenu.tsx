'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { sessionFromClaims, type SessionState } from '@/lib/session';

/**
 * La cabecera de sesión. Hasta acá existían `/auth/login`, `/auth/callback` y
 * `/auth/signout` sin que nada en la interfaz los llamara: este componente es
 * lo que vuelve alcanzable el inicio de sesión (FR-013).
 */
export default function SessionMenu() {
  const [session, setSession] = useState<SessionState>({ kind: 'unknown' });

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const supabase = createClient();
    let active = true;

    const resolve = () =>
      supabase.auth.getClaims().then(
        ({ data }) => {
          if (active) setSession(sessionFromClaims(data?.claims));
        },
        () => {
          if (active) setSession({ kind: 'anonymous' });
        }
      );

    void resolve();

    // El evento trae la sesión guardada por el navegador, que nadie verificó;
    // sirve como aviso de que algo cambió y la firma la vuelve a comprobar
    // `getClaims()`.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void resolve();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Sin las variables de entorno la cabecera se ve igual que antes de las
  // reseñas (T037).
  if (!isSupabaseConfigured()) return null;

  // Un hueco del alto de la fila mientras se resuelve: mostrar «Iniciar sesión»
  // y cambiarlo medio segundo después le parpadea a quien ya tiene sesión.
  if (session.kind === 'unknown') return <div className="h-7 w-24" aria-hidden />;

  if (session.kind === 'anonymous') {
    return (
      // `<a>` y no `<Link>`: /auth/login es un route handler que arranca el OAuth
      // con Google, y el prefetch de Link lo dispararía con solo pasar el mouse.
      <a
        href="/auth/login"
        className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800/60 transition-colors border border-blue-200 dark:border-blue-800"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
        <span>Iniciar sesión</span>
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/perfil"
        title={session.email || undefined}
        className="max-w-[10rem] truncate text-xs font-medium px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
      >
        {session.label}
      </Link>
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="text-xs font-medium px-2 py-1.5 text-gray-500 dark:text-gray-400 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          Salir
        </button>
      </form>
    </div>
  );
}
