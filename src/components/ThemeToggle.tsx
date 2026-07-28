'use client';

/**
 * El tema vive en el DOM (<html class="dark">), aplicado por el script bloqueante
 * de layout.tsx antes del primer paint.
 *
 * Por eso este componente no suscribe a nada: los iconos se resuelven con las
 * variantes dark: de Tailwind (puro CSS, correctas ya en el primer paint) y el
 * estado actual se lee del DOM recién al hacer click. Sin estado de React no hay
 * mismatch de hidratación ni el parpadeo de pintar el icono equivocado hasta que
 * React hidrate.
 */
export default function ThemeToggle() {
  const toggleTheme = () => {
    const root = document.documentElement;
    const isDark = root.classList.contains('dark');
    root.classList.toggle('dark', !isDark);
    try {
      localStorage.setItem('theme', isDark ? 'light' : 'dark');
    } catch {
      // Safari en modo privado: el tema igual cambia en esta sesión.
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="
        relative inline-flex h-10 w-10 items-center justify-center rounded-full
        transition-all duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
        hover:scale-110 active:scale-95
        bg-gray-100 text-blue-900 shadow-sm
        dark:bg-gray-800 dark:text-yellow-300 dark:shadow-[0_0_15px_rgba(253,224,71,0.3)]
      "
      aria-label="Toggle Dark Mode"
    >
      <div className="relative w-5 h-5 overflow-hidden">
        {/* Sun */}
        <svg
          className="
            absolute inset-0 w-full h-full transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
            translate-y-0 opacity-100 scale-100 rotate-0
            dark:translate-y-full dark:opacity-0 dark:scale-50 dark:rotate-90
          "
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>

        {/* Moon */}
        <svg
          className="
            absolute inset-0 w-full h-full transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
            -translate-y-full opacity-0 scale-50 -rotate-90
            dark:translate-y-0 dark:opacity-100 dark:scale-100 dark:rotate-0
          "
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      </div>
    </button>
  );
}
