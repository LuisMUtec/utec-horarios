'use client';

import { useEffect, useId, useRef } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Diálogo centrado y modal. Genérico a propósito: US5 lo necesita para confirmar
 * una eliminación y US6 para el diálogo de reporte.
 *
 * No usa `<dialog>` nativo: `showModal()` es imperativo y obliga a un efecto que
 * lo abra y lo cierre en sincronía con el estado de React, que es justo la clase
 * de duplicación que se desincroniza.
 */
export default function Modal({ title, onClose, children }: Props) {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);

  /**
   * `onClose` llega como una flecha nueva en cada render del padre, y el padre
   * se re-renderiza solo —el hover sobre las secciones, sin ir más lejos—. Con
   * ella en las dependencias, el efecto de abajo se volvía a ejecutar y le
   * robaba el foco al control que el estudiante estuviera usando.
   */
  const cerrar = useRef(onClose);
  useEffect(() => {
    cerrar.current = onClose;
  }, [onClose]);

  // Sin dependencias: esto es lo que pasa al abrir y al cerrar, una sola vez.
  useEffect(() => {
    // Quién tenía el foco antes de abrir, para devolvérselo al cerrar: si no,
    // el foco vuelve al principio de la página y se pierde la sección que se
    // estaba mirando.
    const opener = document.activeElement as HTMLElement | null;
    dialog.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') cerrar.current();
    }

    document.addEventListener('keydown', onKeyDown);
    // El fondo no se desplaza mientras el diálogo está abierto.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      // El fondo cierra, pero solo si el clic empezó y terminó en él: arrastrar
      // una selección desde dentro del diálogo no debería cerrarlo.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" aria-hidden="true" />

      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-xl outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
