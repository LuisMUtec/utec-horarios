'use client';

import { useEffect, useState } from 'react';
import { fetchCareers, updateProfile } from '@/lib/api-client';
import { groupByFaculty, outdatedOption, type Career } from '@/lib/careers';
import {
  TERM_MAX,
  TERM_MIN,
  isProfileComplete,
  profileDiff,
  profileDraft,
  validateProfileUpdate,
  type Profile,
  type ProfileErrors,
} from '@/lib/profile';

const TERMS = Array.from({ length: TERM_MAX - TERM_MIN + 1 }, (_, i) => TERM_MIN + i);

const FIELD_CLASS =
  'w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60 transition-colors';

interface Props {
  /** El perfil ya resuelto en el servidor: sin esto el formulario parpadearía
   *  vacío antes de mostrar lo que el estudiante ya tenía guardado. */
  initial: Profile;
}

export default function ProfileForm({ initial }: Props) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(() => profileDraft(initial));
  const [catalog, setCatalog] = useState<Career[] | null>(null);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;

    fetchCareers().then(
      (careers) => {
        if (active) setCatalog(careers);
      },
      () => {
        if (active) setCatalogFailed(true);
      }
    );

    return () => {
      active = false;
    };
  }, []);

  const groups = groupByFaculty(catalog ?? []);
  const outdated = outdatedOption(catalog ?? [], saved);
  const allowedSlugs = [
    ...(catalog ?? []).map((career) => career.slug),
    ...(saved.careerSlug ? [saved.careerSlug] : []),
  ];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setDone(false);

    // La misma validación que corre el handler: acá solo evita el viaje.
    const validation = validateProfileUpdate(profileDiff(saved, draft), allowedSlugs);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setSaving(true);

    try {
      const result = await updateProfile(validation.value);

      if (result.ok) {
        setSaved(result.profile);
        setDraft(profileDraft(result.profile));
        setDone(true);
      } else {
        setErrors(result.errors);
      }
    } catch {
      setErrors({ form: 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.' });
    } finally {
      setSaving(false);
    }
  }

  const loading = catalog === null && !catalogFailed;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* FR-016: leer no exige nada de esto, y decirlo evita que parezca un
          trámite obligatorio para entrar. */}
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Carrera y ciclo son opcionales para leer reseñas. Los pedimos solo antes de que
        escribas un comentario, como contexto interno de moderación: no se muestran nunca
        junto a tu reseña.
      </p>

      <div>
        <label
          htmlFor="career"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Carrera
        </label>
        <select
          id="career"
          value={draft.careerSlug}
          disabled={loading || saving}
          onChange={(event) => setDraft({ ...draft, careerSlug: event.target.value })}
          className={FIELD_CLASS}
        >
          <option value="">{loading ? 'Cargando carreras…' : 'Sin especificar'}</option>
          {outdated && (
            <option value={outdated.slug}>{outdated.name} (ya no vigente)</option>
          )}
          {groups.map((group) => (
            <optgroup key={group.faculty} label={group.faculty}>
              {group.careers.map((career) => (
                <option key={career.slug} value={career.slug}>
                  {career.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {catalogFailed && (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            No se pudo cargar la lista de carreras. Puedes actualizar tu ciclo igual.
          </p>
        )}
        {errors.careerSlug && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.careerSlug}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="term"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Ciclo actual
        </label>
        <select
          id="term"
          value={draft.term}
          disabled={saving}
          onChange={(event) => setDraft({ ...draft, term: event.target.value })}
          className={FIELD_CLASS}
        >
          <option value="">Sin especificar</option>
          {TERMS.map((value) => (
            <option key={value} value={String(value)}>
              {value}
            </option>
          ))}
        </select>
        {errors.term && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.term}</p>
        )}
      </div>

      {errors.form && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {errors.form}
        </p>
      )}

      {done && (
        <p className="text-sm text-green-700 dark:text-green-400" role="status">
          Listo, tu perfil quedó guardado.
        </p>
      )}

      {!isProfileComplete(saved) && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Te faltan datos para poder escribir comentarios. Las puntuaciones sin comentario
          no los necesitan.
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-blue-600 dark:bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-60 transition-colors"
      >
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}
