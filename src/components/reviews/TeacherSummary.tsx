'use client';

import { SummaryState } from '@/types/reviews';
import {
  EMPTY_SUMMARY_LABEL,
  ERROR_SUMMARY_LABEL,
  RECOMMEND_LABEL,
  UNASSIGNED_TEACHER_LABEL,
  formatAverageRating,
  formatCommentCount,
  formatRatingCount,
  formatRecommendPercentage,
  formatSummaryAriaLabel,
  ratingFillPercentage,
} from '@/lib/review-format';

/** Lo que hace falta para abrir el detalle. Sin esto el resumen es solo lectura,
 *  que es como se ve un `Docente por asignar` (FR-054, T062). */
export interface DetailToggle {
  expanded: boolean;
  /** Id del panel que este control abre, para `aria-controls`. */
  panelId: string;
  onToggle: () => void;
}

interface Props {
  /** Nombre tal como lo publica la oferta. No se pinta: la tarjeta de sección ya
   *  lo muestra, acá solo entra en el texto equivalente del resumen. */
  teacherName: string;
  state: SummaryState;
  detail?: DetailToggle;
}

const MUTED = 'text-gray-500 dark:text-gray-400';
const VALUE = 'font-semibold tabular-nums text-gray-700 dark:text-gray-200';

/** La capa llena se recorta al promedio (FR-003). */
function Stars({ average }: { average: number }) {
  return (
    <span className="relative inline-block leading-none">
      <span className="text-gray-300 dark:text-gray-600">★★★★★</span>
      <span
        className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-amber-500 dark:text-amber-400"
        style={{ width: `${ratingFillPercentage(average)}%` }}
      >
        ★★★★★
      </span>
    </span>
  );
}

function Separator() {
  return <span className="text-gray-300 dark:text-gray-600">·</span>;
}

/** Lo visible son fragmentos sueltos y glifos; el texto equivalente lo arma
 *  `formatSummaryAriaLabel` y por eso esa parte va oculta al lector. El control
 *  del detalle queda fuera del `aria-hidden`, o no habría cómo abrirlo. */
function Row({
  label,
  detail,
  teacherName,
  children,
}: {
  label: string;
  detail?: DetailToggle;
  teacherName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-[11px]">
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        {children}
      </span>
      {detail && <DetailButton detail={detail} teacherName={teacherName ?? ''} />}
    </div>
  );
}

function DetailButton({ detail, teacherName }: { detail: DetailToggle; teacherName: string }) {
  const action = detail.expanded ? 'Ocultar comentarios' : 'Ver comentarios';
  const name = teacherName.trim();

  return (
    <button
      type="button"
      onClick={detail.onToggle}
      aria-expanded={detail.expanded}
      aria-controls={detail.panelId}
      className="mt-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
    >
      <span aria-hidden="true">{action}</span>
      {/* Con varios docentes en la sección, «Ver comentarios» a secas se repite
          y no dice de quién. */}
      <span className="sr-only">{name === '' ? action : `${action} de ${name}`}</span>
    </button>
  );
}

export default function TeacherSummary({ teacherName, state, detail }: Props) {
  const label = formatSummaryAriaLabel(teacherName, state);

  if (state.kind === 'empty') {
    return (
      <Row label={label} detail={detail} teacherName={teacherName}>
        <span className="italic text-gray-400 dark:text-gray-500">{EMPTY_SUMMARY_LABEL}</span>
      </Row>
    );
  }

  // Chip punteado: no hay a quién evaluar, que es distinto de nadie lo evaluó (SC-002).
  if (state.kind === 'unassigned') {
    return (
      <Row label={label}>
        <span className="rounded border border-dashed border-gray-300 px-1.5 py-0.5 text-gray-400 dark:border-gray-600 dark:text-gray-500">
          {UNASSIGNED_TEACHER_LABEL}
        </span>
      </Row>
    );
  }

  // Barra en movimiento y aviso en rojo: ni uno ni otro se leen como un docente
  // sin reseñas, que es lo que mide SC-002.
  if (state.kind === 'loading') {
    return (
      <Row label={label}>
        <span className="inline-block h-3 w-28 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </Row>
    );
  }

  if (state.kind === 'error') {
    return (
      <Row label={label}>
        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
          <span>⚠</span>
          {ERROR_SUMMARY_LABEL}
        </span>
      </Row>
    );
  }

  const { summary } = state;
  const average = formatAverageRating(summary.averageRating);
  const recommendation = formatRecommendPercentage(summary.recommendPercentage);

  return (
    <Row label={label} detail={detail} teacherName={teacherName}>
      {average !== null && (
        <span className="inline-flex items-center gap-1">
          <Stars average={summary.averageRating} />
          <span className={VALUE}>{average}</span>
        </span>
      )}

      <span className={MUTED}>{formatRatingCount(summary.ratingCount)}</span>

      {recommendation !== null && (
        <>
          <Separator />
          <span className={MUTED}>
            <span className={VALUE}>{recommendation}</span> {RECOMMEND_LABEL}
          </span>
        </>
      )}

      <Separator />
      <span className={MUTED}>{formatCommentCount(summary.commentCount)}</span>
    </Row>
  );
}
