'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const root = window.document.documentElement;
    if (root.classList.contains('dark')) {
      setIsDark(true);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches && !localStorage.getItem('theme')) {
      setIsDark(true);
      root.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const root = window.document.documentElement;
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  if (!mounted) {
    return <div className="w-10 h-10" />; // placeholder to prevent layout shift
  }

  return (
    <button
      onClick={toggleTheme}
      className={`
        relative inline-flex h-10 w-10 items-center justify-center rounded-full
        transition-all duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
        hover:scale-110 active:scale-95
        ${isDark ? 'bg-gray-800 text-yellow-300 shadow-[0_0_15px_rgba(253,224,71,0.3)]' : 'bg-gray-100 text-blue-900 shadow-sm'}
      `}
      aria-label="Toggle Dark Mode"
    >
      <div className="relative w-5 h-5 overflow-hidden">
        {/* Sun */}
        <svg
          className={`absolute inset-0 w-full h-full transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            isDark ? 'translate-y-full opacity-0 scale-50 rotate-90' : 'translate-y-0 opacity-100 scale-100 rotate-0'
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>

        {/* Moon */}
        <svg
          className={`absolute inset-0 w-full h-full transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            isDark ? 'translate-y-0 opacity-100 scale-100 rotate-0' : '-translate-y-full opacity-0 scale-50 -rotate-90'
          }`}
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
