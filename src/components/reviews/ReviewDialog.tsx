'use client';

import { useEffect, useState } from 'react';
import { fetchPairReviews, publishReview, type PairReviewsResult } from '@/lib/api-client';
import {
  OWN_RECOMMEND_LABELS,
  RATING_SCALE_MAX,
  formatRatingLimitMessage,
  ratingFillPercentage,
} from '@/lib/review-format';
import {
  DUPLICATE_REVIEW_MESSAGE,
  OWN_REVIEW_TITLE,
  SESSION_LOST_MESSAGE,
  type ReviewDraft,
  type ReviewErrors,
} from '@/lib/review-submit';
import type { OwnReview } from '@/types/reviews';
import ReviewForm from './ReviewForm';

interface Props {
  courseCode: string;
  teacherEmail: string;
  teacherName: string;
  /** Publicó: el diálogo se cierra y el resumen de arriba se vuelve a pedir
   *  (SC-005). La caché ya la invalidó `publishReview`. */
  onPublished: () => void;
}

type DialogState = { kind: 'loading' } | { kind: 'error' } | PairReviewsResult;

const NOTE = 'text-xs leading-relaxed text-gray-500 dark:text-gray-400';

/** La reseña propia, en solo lectura (FR-027). Editarla y eliminarla llegan con US5. */
function OwnReviewCard({ review }: { review: OwnReview }) {
  return (
    <div className="rounded-md border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/30 p-3">
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{OWN_REVIEW_TITLE}</p>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span aria-hidden="true" className="relative inline-block leading-none">
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
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
            review.recommends
              ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
          }`}
        >
          {review.recommends ? OWN_RECOMMEND_LABELS.yes : OWN_RECOMMEND_LABELS.no}
        </span>
      </div>
    </div>
  );
}

/**
 * El contenido del diálogo de un par docente–curso: puntuar, o lo que impide
 * hacerlo. Va en un modal y no debajo del resumen porque el formulario vivía
 * dentro del desplegable de búsqueda, que lo recortaba.
 *
 * Nada de esto navega a otra página: salir costaría la selección del horario
 * que el estudiante viene armando (FR-012).
 *
 * Los comentarios no se listan todavía —ver `COMMENTS_ENABLED`—, así que el
 * diálogo es solo la puntuación.
 */
export default function ReviewDialog({
  courseCode,
  teacherEmail,
  teacherName,
  onPublished,
}: Props) {
  const [state, setState] = useState<DialogState>({ kind: 'loading' });

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

  /**
   * Devuelve los errores que el formulario tiene que mostrar, o `null` si entró.
   * Lo que no vuelve como error cambia la pantalla entera: una sanción y un par
   * retirado no se arreglan reintentando.
   */
  async function publish(draft: ReviewDraft): Promise<ReviewErrors | null> {
    const result = await publishReview(courseCode, teacherEmail, draft);

    switch (result.kind) {
      case 'published':
        onPublished();
        return null;

      // El servidor rechazó campos que la validación del formulario dejó pasar.
      // Sus errores se muestran tal cual: son los que cuentan.
      case 'invalid':
        return result.errors;

      // FR-027: ya había una. Se muestra en lugar del formulario, sin cerrar.
      case 'duplicate':
        if (result.own === null) return { form: DUPLICATE_REVIEW_MESSAGE };
        setState((current) =>
          current.kind === 'ok'
            ? { ...current, reviews: { ...current.reviews, own: result.own } }
            : current
        );
        return null;

      // FR-030 y FR-031: el texto se arma acá con el instante que dio el trigger.
      case 'rate_limit':
        return {
          form: result.releaseAt ? formatRatingLimitMessage(result.releaseAt) : result.message,
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
    }
    // Sin `default`: el switch cubre la unión entera, así que un desenlace nuevo
    // en `PublishReviewResult` rompe el typecheck en vez de caer en un mensaje
    // genérico que nadie escribió para él.
  }

  if (state.kind === 'loading') {
    return (
      <div className="space-y-2" aria-busy="true">
        <span className="block h-3 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <span className="block h-3 w-4/5 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <span className="sr-only">Cargando</span>
      </div>
    );
  }

  // FR-013. La sesión no la comprueba este componente: la respuesta 401 del
  // handler es la única fuente, y así no hay dos opiniones sobre si hay sesión.
  if (state.kind === 'anonymous') {
    return (
      <div>
        <p className={NOTE}>
          Inicia sesión con tu cuenta de UTEC para poder puntuar.
        </p>
        {/* `<a>` y no `<Link>`: /auth/login arranca el OAuth con Google y el
            prefetch de Link lo dispararía con solo pasar el mouse. */}
        <a
          href="/auth/login"
          className="mt-3 inline-block rounded-md bg-blue-600 dark:bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 dark:hover:bg-blue-600"
        >
          Iniciar sesión
        </a>
      </div>
    );
  }

  // FR-057: el motivo, cada vez que intente usar la funcionalidad.
  if (state.kind === 'banned') {
    return (
      <div className="rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-3">
        <p className="text-xs leading-relaxed text-red-800 dark:text-red-200">
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
    return <p className={NOTE}>Este docente ya no dicta este curso.</p>;
  }

  if (state.kind === 'error') {
    return (
      <p className="text-xs text-red-600 dark:text-red-400">
        No se pudieron cargar las reseñas. Inténtalo de nuevo más tarde.
      </p>
    );
  }

  const { own } = state.reviews;

  return own === null ? (
    <ReviewForm teacherName={teacherName} onPublish={publish} />
  ) : (
    <OwnReviewCard review={own} />
  );
}
