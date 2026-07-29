'use client';

import { RATING_SCALE_MAX, formatStarOptionLabel } from '@/lib/review-format';
import { RATING_MIN } from '@/lib/review-submit';

interface Props {
  /** `null` es «todavía no eligió»: FR-021 no admite un valor preseleccionado. */
  value: number | null;
  onChange: (rating: number) => void;
  /** Distingue los grupos cuando hay más de un formulario en la página. */
  name: string;
  describedBy?: string;
}

const OPTIONS = Array.from(
  { length: RATING_SCALE_MAX - RATING_MIN + 1 },
  (_, index) => RATING_MIN + index
);

/**
 * Radios de verdad, no botones con `aria-pressed`: así las flechas del teclado
 * recorren la escala y el lector la anuncia como un grupo de opciones, sin
 * escribir una sola línea de manejo de teclas.
 */
export default function StarRating({ value, onChange, name, describedBy }: Props) {
  return (
    <fieldset aria-describedby={describedBy}>
      <legend className="sr-only">Puntuación de {RATING_SCALE_MAX} estrellas</legend>

      <div className="flex items-center gap-0.5">
        {OPTIONS.map((option) => {
          const filled = value !== null && option <= value;

          return (
            <label
              key={option}
              className="cursor-pointer rounded p-0.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500"
            >
              <input
                type="radio"
                name={name}
                value={option}
                checked={value === option}
                onChange={() => onChange(option)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`text-lg leading-none ${
                  filled
                    ? 'text-amber-500 dark:text-amber-400'
                    : 'text-gray-300 dark:text-gray-600'
                }`}
              >
                ★
              </span>
              <span className="sr-only">{formatStarOptionLabel(option)}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
