import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProfileForm from '@/components/ProfileForm';
import { resolveStudent } from '@/lib/api-guards';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Tu perfil · UTEC Horarios',
};

/**
 * Explícito y no derivado de `cookies()`: el job `build` del CI corre sin
 * secretos, y ahí `isSupabaseConfigured()` es falso y la página se resolvería
 * como un 404 estático que después no cambia en producción.
 */
export const dynamic = 'force-dynamic';

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-xl p-6">
      <Link
        href="/"
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
      >
        ← Volver al horario
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
      <div className="mt-6">{children}</div>
    </main>
  );
}

export default async function ProfilePage() {
  if (!isSupabaseConfigured()) notFound();

  const supabase = await createClient();

  let access;
  try {
    access = await resolveStudent(supabase);
  } catch (error) {
    console.error('Error al resolver el perfil:', error);

    return (
      <Shell title="Tu perfil">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          No se pudo cargar tu perfil. Inténtalo de nuevo más tarde.
        </p>
      </Shell>
    );
  }

  if (access.kind === 'anonymous') {
    return (
      <Shell title="Tu perfil">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Inicia sesión con tu cuenta UTEC para ver y editar tu perfil.
        </p>
        {/* Sin `<Link>`: /auth/login arranca el OAuth y el prefetch lo dispararía. */}
        <a
          href="/auth/login"
          className="mt-4 inline-block rounded-lg bg-blue-600 dark:bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
        >
          Iniciar sesión
        </a>
      </Shell>
    );
  }

  // FR-057: el motivo va en la página, no escondido detrás de un error al
  // intentar publicar.
  if (access.kind === 'banned') {
    return (
      <Shell title="Tu acceso fue retirado">
        <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-4">
          <p className="text-sm text-red-800 dark:text-red-200">
            Tu acceso a las reseñas fue retirado de forma permanente. No puedes leer
            comentarios, publicar, editar, eliminar ni reportar.
          </p>
          <p className="mt-3 text-sm text-red-800 dark:text-red-200">
            <span className="font-semibold">Motivo:</span> {access.reason}
          </p>
        </div>
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Sigues pudiendo armar tu horario y ver los promedios públicos. Las{' '}
          <Link href="/normas" className="text-blue-600 dark:text-blue-400 hover:underline">
            normas de la comunidad
          </Link>{' '}
          explican qué se revisa y qué pasa después.
        </p>
      </Shell>
    );
  }

  const { careerSlug, careerName, term } = access.student;

  return (
    <Shell title="Tu perfil">
      <ProfileForm initial={{ careerSlug, careerName, term }} />
    </Shell>
  );
}
