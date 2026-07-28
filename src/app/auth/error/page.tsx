import Link from 'next/link';

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 text-center">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          No se pudo iniciar sesión
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {error ?? 'Ocurrió un error inesperado durante el inicio de sesión.'}
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-blue-600 dark:bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
        >
          Volver al horario
        </Link>
      </div>
    </main>
  );
}
