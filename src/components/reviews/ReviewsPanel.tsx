'use client';

import { useEffect, useState } from 'react';
import { fetchPairReviews, publishReview, type PairReviewsResult } from '@/lib/api-client';
import {
  NO_COMMENTS_LABEL,
  OWN_RECOMMEND_LABELS,
  RATING_SCALE_MAX,
  formatRatingLimitMessage,
  ratingFillPercentage,
} from '@/lib/review-format';
import {
  DUPLICATE_REVIEW_MESSAGE,
  OWN_REVIEW_NOTE,
  OWN_REVIEW_TITLE,
  PUBLISHED_MESSAGE,
  SESSION_LOST_MESSAGE,
  type ReviewDraft,
  type ReviewErrors,
} from '@/lib/review-submit';
import type { OwnReview } from '@/types/reviews';
import CommentList from './CommentList';
import ReviewForm from './ReviewForm';

interface Props {
  courseCode: string;
  teacherEmail: string;
  teacherName: string;
  /** Lo llama al publicar, para que el resumen de arriba deje de estar viejo
   *  (SC-005). La caché ya la invalidó `publishReview`. */
  onPublished?: () => void;
}

type PanelState = { kind: 'loading' } | { kind: 'error' } | PairReviewsResult;

const NOTE = 'text-[11px] leading-relaxed text-gray-500 dark:text-gray-400';

/**
 * El detalle de un par docente–curso. Se abre debajo de su resumen y sin
 * navegar a ninguna parte: salir de la página costaría la selección del horario
 * que el estudiante viene armando (FR-012, escenario 7).
 */
/** La reseña propia, en solo lectura (FR-027). Editarla y eliminarla llegan con US5. */
function OwnReviewCard({ review, confirmed }: { review: OwnReview; confirmed: boolean }) {
  return (
    <div className="mt-2 rounded-md border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/30 p-2.5">
      <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
        {OWN_REVIEW_TITLE}
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span aria-hidden="true" className="relative inline-block text-xs leading-none">
          <span className="text-gray-300 dark:text-gray-600">★★★★★</span>
          <span
            className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-amber-500 dark:text-amber-400"
            style={{ width: `${ratingFillPercentage(review.rating)}%` }}
          >
            ★★★★★
          </span>
        </span>
        <span className="sr-only">
          {review.rating} de {RATING_SCALE_MAX} estrellas
        </span>

        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
            review.recommends
              ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
          }`}
        >
          {review.recommends ? OWN_RECOMMEND_LABELS.yes : OWN_RECOMMEND_LABELS.no}
        </span>
      </div>

      {confirmed && (
        <p role="status" className="mt-1.5 text-[11px] text-green-700 dark:text-green-300">
          {PUBLISHED_MESSAGE}
        </p>
      )}

      <p className={`mt-1.5 ${NOTE}`}>{OWN_REVIEW_NOTE}</p>
    </div>
  );
}

export default function ReviewsPanel({
  courseCode,
  teacherEmail,
  teacherName,
  onPublished,
}: Props) {
  const [state, setState] = useState<PanelState>({ kind: 'loading' });
  const [confirmed, setConfirmed] = useState(false);

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

  /** Guarda la reseña propia que acaba de existir, sin volver a pedir el par. */
  function keepOwn(own: OwnReview | null) {
    setState((current) =>
      current.kind === 'ok' ? { ...current, reviews: { ...current.reviews, own } } : current
    );
  }

  /**
   * Devuelve los errores que el formulario tiene que mostrar, o `null` si entró.
   * Lo que no vuelve como error cambia la pantalla entera: una sanción y un par
   * retirado no se arreglan reintentando.
   */
  async function publish(draft: ReviewDraft): Promise<ReviewErrors | null> {
    const result = await publishReview(courseCode, teacherEmail, draft);

    switch (result.kind) {
      case 'published':
        keepOwn(result.review);
        setConfirmed(true);
        onPublished?.();
        return null;

      // FR-027: ya había una. Se muestra en lugar del formulario.
      case 'duplicate':
        if (result.own === null) return { form: DUPLICATE_REVIEW_MESSAGE };
        keepOwn(result.own);
        return null;

      // FR-030 y FR-031: el texto se arma acá con el instante que dio el trigger.
      case 'rate_limit':
        return {
          form: result.releaseAt
            ? formatRatingLimitMessage(result.releaseAt)
            : result.message,
        };

      // El formulario sigue montado, así que lo elegido sigue en pantalla.
      case 'anonymous':
        return { form: SESSION_LOST_MESSAGE };

      case 'banned':
        setState({ kind: 'banned', reason: result.reason });
        return null;

      case 'not_current':
        setState({ kind: 'missing' });
        return null;

      default:
        return { form: 'No se pudo publicar la reseña. Inténtalo de nuevo más tarde.' };
    }
  }

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

  const { own, comments } = state.reviews;

  return (
    <div className="mt-2">
      {own === null ? (
        <ReviewForm teacherName={teacherName} onPublish={publish} />
      ) : (
        <OwnReviewCard review={own} confirmed={confirmed} />
      )}

      {/* Escenario 27: el promedio sigue arriba, en el resumen, que no se
          reemplaza al abrir el detalle. Acá no se rellena con nada ni se pide
          contribuir. */}
      {comments.length === 0 ? (
        <p className={`mt-2 ${NOTE}`}>{NO_COMMENTS_LABEL}</p>
      ) : (
        <div className="mt-2">
          <CommentList comments={comments} />
        </div>
      )}
    </div>
  );
}
