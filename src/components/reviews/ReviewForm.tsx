'use client';

import { useId, useState } from 'react';
import {
  ATTENDANCE_LABEL,
  EMPTY_REVIEW_DRAFT,
  RATING_QUESTION,
  RECOMMEND_NO_LABEL,
  RECOMMEND_QUESTION,
  RECOMMEND_YES_LABEL,
  validateReviewSubmission,
  type ReviewDraft,
  type ReviewErrors,
} from '@/lib/review-submit';
import StarRating from './StarRating';

interface Props {
  /** Curso y docente llegan preseleccionados y no se pueden cambiar (FR-028). */
  teacherName: string;
  /** Devuelve los errores que impidieron publicar, o `null` si la reseña entró. */
  onPublish: (draft: ReviewDraft) => Promise<ReviewErrors | null>;
}

const FIELD = 'mt-3 first:mt-0';
const QUESTION = 'text-[11px] font-medium text-gray-700 dark:text-gray-200';

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;

  return (
    <p id={id} role="alert" className="mt-1 text-[11px] leading-relaxed text-red-600 dark:text-red-400">
      {message}
    </p>
  );
}

/**
 * Puntuar y recomendar (FR-021, FR-061). Sin comentario: esta contribución no
 * exige carrera, ciclo ni compromiso de respeto (SC-003), y por eso el
 * formulario no los pinta ni los menciona.
 *
 * El borrador vive en el estado del componente y no en `localStorage`: si la
 * sesión se cae, lo elegido sigue en pantalla para reintentar (edge case
 * *Pérdida de sesión durante la publicación*) sin quedarse en el dispositivo
 * más tiempo del necesario.
 */
export default function ReviewForm({ teacherName, onPublish }: Props) {
  const [draft, setDraft] = useState<ReviewDraft>(EMPTY_REVIEW_DRAFT);
  const [errors, setErrors] = useState<ReviewErrors>({});
  const [publishing, setPublishing] = useState(false);

  const id = useId();
  const errorIds = {
    declaredAttendance: `${id}-attendance-error`,
    rating: `${id}-rating-error`,
    recommends: `${id}-recommends-error`,
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (publishing) return;

    // La validación de acá solo evita un viaje; la que cuenta es la del handler.
    const validation = validateReviewSubmission(draft);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setPublishing(true);
    const rejected = await onPublish(draft).catch(() => ({
      form: 'No se pudo publicar la reseña. Inténtalo de nuevo más tarde.',
    }));
    setPublishing(false);

    // Con la reseña publicada el panel reemplaza este formulario; limpiar el
    // borrador acá solo haría parpadear un formulario vacío antes de que ocurra.
    if (rejected) setErrors(rejected);
  }

  return (
    <form onSubmit={submit} noValidate className="mt-2">
      <div className={FIELD}>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={draft.declaredAttendance}
            onChange={(event) =>
              setDraft({ ...draft, declaredAttendance: event.target.checked })
            }
            aria-invalid={errors.declaredAttendance ? true : undefined}
            aria-describedby={errors.declaredAttendance ? errorIds.declaredAttendance : undefined}
            className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-blue-600 dark:accent-blue-500"
          />
          <span className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-200">
            {ATTENDANCE_LABEL}
          </span>
        </label>
        <FieldError id={errorIds.declaredAttendance} message={errors.declaredAttendance} />
      </div>

      <div className={FIELD}>
        <p className={QUESTION}>{RATING_QUESTION}</p>
        <div className="mt-1">
          <StarRating
            name={`${id}-rating`}
            value={draft.rating}
            onChange={(rating) => setDraft({ ...draft, rating })}
            describedBy={errors.rating ? errorIds.rating : undefined}
          />
        </div>
        <FieldError id={errorIds.rating} message={errors.rating} />
      </div>

      {/* FR-061: las dos opciones arrancan sin marcar. */}
      <div className={FIELD}>
        <fieldset aria-describedby={errors.recommends ? errorIds.recommends : undefined}>
          <legend className={QUESTION}>{RECOMMEND_QUESTION}</legend>
          <div className="mt-1 flex items-center gap-3">
            {[
              { label: RECOMMEND_YES_LABEL, value: true },
              { label: RECOMMEND_NO_LABEL, value: false },
            ].map((option) => (
              <label
                key={option.label}
                className="flex cursor-pointer items-center gap-1.5 text-[11px] text-gray-700 dark:text-gray-200"
              >
                <input
                  type="radio"
                  name={`${id}-recommends`}
                  checked={draft.recommends === option.value}
                  onChange={() => setDraft({ ...draft, recommends: option.value })}
                  className="h-3.5 w-3.5 accent-blue-600 dark:accent-blue-500"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
        <FieldError id={errorIds.recommends} message={errors.recommends} />
      </div>

      <FieldError id={`${id}-form-error`} message={errors.form} />

      <button
        type="submit"
        disabled={publishing}
        className="mt-3 rounded-md bg-blue-600 dark:bg-blue-500 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-60"
      >
        {publishing ? 'Publicando…' : 'Publicar'}
      </button>

      <span className="sr-only">
        Reseña de {teacherName.trim()}. El curso y el docente no se pueden cambiar.
      </span>
    </form>
  );
}
