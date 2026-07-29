import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { TeacherSummary } from '@/types/reviews';

/** El cliente llega por parámetro: sin él, esta capa no sería testeable en node. */
export type ReviewsClient = SupabaseClient<Database>;

/** Lista explícita, no `*`: una columna nueva en la vista no viaja sola (FR-019). */
const SUMMARY_COLUMNS =
  'course_teacher_id, course_code, teacher_email, teacher_name, average_rating, rating_count, comment_count, recommend_percentage';

type SummaryRow = Database['public']['Views']['teacher_course_summaries']['Row'];

/** Los agregados pueden llegar como texto: `numeric` y `bigint` no caben en un
 *  `number` de JSON y algunos drivers los serializan como string. */
type RawSummaryRow = Omit<
  SummaryRow,
  'average_rating' | 'rating_count' | 'comment_count' | 'recommend_percentage'
> & {
  average_rating: number | string | null;
  rating_count: number | string | null;
  comment_count: number | string | null;
  recommend_percentage: number | string | null;
};

function toNumber(value: number | string | null): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Proyección campo por campo (FR-019). Los `??` cubren la nulabilidad que los
 *  tipos generados le dan a toda columna de vista; el `group by` la descarta. */
function toTeacherSummary(row: RawSummaryRow): TeacherSummary {
  return {
    courseTeacherId: row.course_teacher_id ?? '',
    courseCode: row.course_code ?? '',
    teacherEmail: row.teacher_email ?? '',
    teacherName: row.teacher_name ?? '',
    averageRating: toNumber(row.average_rating),
    ratingCount: toNumber(row.rating_count),
    commentCount: toNumber(row.comment_count),
    recommendPercentage: toNumber(row.recommend_percentage),
  };
}

/** Resúmenes de todos los docentes de un curso (FR-002, FR-008). */
export async function getCourseSummaries(
  client: ReviewsClient,
  courseCode: string
): Promise<TeacherSummary[]> {
  const { data, error } = await client
    .from('teacher_course_summaries')
    .select(SUMMARY_COLUMNS)
    .eq('course_code', courseCode);

  if (error) {
    throw new Error(
      `No se pudieron cargar los resúmenes del curso ${courseCode}: ${error.message}`
    );
  }

  return ((data ?? []) as RawSummaryRow[]).map(toTeacherSummary);
}
