'use client';

import { useEffect, useState } from 'react';
import { fetchPairReviews, type PairReviewsResult } from '@/lib/api-client';
import { NO_COMMENTS_LABEL } from '@/lib/review-format';
import CommentList from './CommentList';

interface Props {
  courseCode: string;
  teacherEmail: string;
}

type PanelState = { kind: 'loading' } | { kind: 'error' } | PairReviewsResult;

const NOTE = 'text-[11px] leading-relaxed text-gray-500 dark:text-gray-400';

/**
 * El detalle de un par docente–curso. Se abre debajo de su resumen y sin
 * navegar a ninguna parte: salir de la página costaría la selección del horario
 * que el estudiante viene armando (FR-012, escenario 7).
 */
export default function ReviewsPanel({ courseCode, teacherEmail }: Props) {
  const [state, setState] = useState<PanelState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;

    fetchPairReviews(courseCode, teacherEmail).then(
      (result) => {
        if (active) setState(result);
      },
      () => {
        if (active) setState({ kind: 'error' });
      }
    );

    return () => {
      active = false;
    };
  }, [courseCode, teacherEmail]);

  if (state.kind === 'loading') {
    return (
      <div className="mt-2 space-y-1.5" aria-busy="true">
        <span className="block h-3 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <span className="block h-3 w-4/5 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <span className="sr-only">Cargando comentarios</span>
      </div>
    );
  }

  // FR-013. La sesión no la comprueba este componente: la respuesta 401 del
  // handler es la única fuente, y así no hay dos opiniones sobre si hay sesión.
  if (state.kind === 'anonymous') {
    return (
      <div className="mt-2">
        <p className={NOTE}>
          Inicia sesión con tu cuenta UTEC para leer los comentarios. Los promedios y
          conteos se ven sin iniciar sesión.
        </p>
        {/* `<a>` y no `<Link>`: /auth/login arranca el OAuth con Google y el
            prefetch de Link lo dispararía con solo pasar el mouse. */}
        <a
          href="/auth/login"
          className="mt-1.5 inline-block rounded-md bg-blue-600 dark:bg-blue-500 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
        >
          Iniciar sesión
        </a>
      </div>
    );
  }

  // FR-057: el motivo, cada vez que intente leer comentarios.
  if (state.kind === 'banned') {
    return (
      <div className="mt-2 rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-2.5">
        <p className="text-[11px] leading-relaxed text-red-800 dark:text-red-200">
          Tu acceso a las reseñas fue retirado de forma permanente.
          {state.reason && (
            <>
              {' '}
              <span className="font-semibold">Motivo:</span> {state.reason}
            </>
          )}
        </p>
      </div>
    );
  }

  if (state.kind === 'missing') {
    return <p className={`mt-2 ${NOTE}`}>Este docente ya no dicta este curso.</p>;
  }

  if (state.kind === 'error') {
    return (
      <p className="mt-2 text-[11px] text-red-600 dark:text-red-400">
        No se pudieron cargar los comentarios. Inténtalo de nuevo más tarde.
      </p>
    );
  }

  // Escenario 27: el promedio sigue arriba, en el resumen, que no se reemplaza
  // al abrir el detalle. Acá no se rellena con nada ni se pide contribuir.
  if (state.reviews.comments.length === 0) {
    return <p className={`mt-2 ${NOTE}`}>{NO_COMMENTS_LABEL}</p>;
  }

  return (
    <div className="mt-2">
      <CommentList comments={state.reviews.comments} />
    </div>
  );
}
