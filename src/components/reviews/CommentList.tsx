'use client';

import {
  EDITED_LABEL,
  RATING_SCALE_MAX,
  RECOMMEND_LABEL,
  formatCommentDate,
  ratingFillPercentage,
} from '@/lib/review-format';
import type { PairComment } from '@/types/reviews';

/** Misma capa recortada que el resumen (FR-003), en tamaño de fila. */
function Stars({ rating }: { rating: number }) {
  return (
    <span className="relative inline-block leading-none text-xs">
      <span className="text-gray-300 dark:text-gray-600">★★★★★</span>
      <span
        className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-amber-500 dark:text-amber-400"
        style={{ width: `${ratingFillPercentage(rating)}%` }}
      >
        ★★★★★
      </span>
    </span>
  );
}

/** FR-035. Nada del autor: no se omite al pintar, es que no viene (SC-006). */
function Comment({ comment }: { comment: PairComment }) {
  const published = formatCommentDate(comment.publishedAt);

  return (
    <li className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span aria-hidden="true" className="inline-flex items-center gap-1">
          <Stars rating={comment.rating} />
          <span className="text-[11px] font-semibold tabular-nums text-gray-700 dark:text-gray-200">
            {comment.rating}
          </span>
        </span>
        <span className="sr-only">
          {comment.rating} de {RATING_SCALE_MAX} estrellas
        </span>

        {comment.recommends && (
          <span className="rounded bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-300">
            {RECOMMEND_LABEL}
          </span>
        )}
      </div>

      <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-gray-700 dark:text-gray-300">
        {comment.comment}
      </p>

      {published && (
        <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">
          {published}
          {/* FR-055: la marca acompaña a la fecha de publicación, no la sustituye. */}
          {comment.editedAt && <span className="ml-1 italic">({EDITED_LABEL})</span>}
        </p>
      )}
    </li>
  );
}

export default function CommentList({ comments }: { comments: PairComment[] }) {
  return (
    <ul className="space-y-2">
      {comments.map((comment) => (
        <Comment key={comment.id} comment={comment} />
      ))}
    </ul>
  );
}
