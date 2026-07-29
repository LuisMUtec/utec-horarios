import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { OwnReview, PairComment, TeacherSummary } from '@/types/reviews';

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

/** Lista explícita otra vez: la vista no tiene `author_id`, y pedir columna por
 *  columna es lo que impide que una columna nueva se cuele sola (SC-006). */
const COMMENT_COLUMNS =
  'id, rating, recommends, comment, comment_published_at, comment_edited_at';

type CommentRow = Database['public']['Views']['review_comments']['Row'];

/**
 * Los comentarios de un par docente–curso (FR-034, ordenados por FR-064/D2).
 *
 * La vista ya aplica FR-046 y FR-049. Acá no se vuelve a filtrar: sería una
 * segunda frontera, y dos fronteras se desincronizan.
 */
export async function getPairComments(
  client: ReviewsClient,
  courseCode: string,
  teacherEmail: string
): Promise<PairComment[]> {
  const { data, error } = await client
    .from('review_comments')
    .select(COMMENT_COLUMNS)
    .eq('course_code', courseCode)
    .eq('teacher_email', teacherEmail)
    .order('comment_published_at', { ascending: false });

  if (error) {
    throw new Error(`No se pudieron cargar los comentarios: ${error.message}`);
  }

  return ((data ?? []) as CommentRow[]).flatMap(toPairComment);
}

/**
 * Devuelve un arreglo porque una fila sin texto no produce entrada (FR-036).
 * No duplica el `comment is not null` de la vista: es lo que vuelve cierto el
 * `comment: string` del tipo, nullable en toda columna de vista generada.
 */
function toPairComment(row: CommentRow): PairComment[] {
  if (row.id === null || row.comment === null || row.comment_published_at === null) return [];

  return [
    {
      id: row.id,
      rating: row.rating ?? 0,
      recommends: row.recommends ?? false,
      comment: row.comment,
      publishedAt: row.comment_published_at,
      editedAt: row.comment_edited_at,
    },
  ];
}

/** El id del par vigente, o `null` si no existe o salió de la oferta (R6). */
export async function getCourseTeacherId(
  client: ReviewsClient,
  courseCode: string,
  teacherEmail: string
): Promise<string | null> {
  const { data, error } = await client
    .from('course_teachers')
    .select('id')
    .eq('course_code', courseCode)
    .eq('teacher_email', teacherEmail)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo resolver el docente del curso: ${error.message}`);
  }

  return data?.id ?? null;
}

/**
 * La reseña propia del par, si existe. Sin filtro por autor: lo aplica la
 * política, y repetirlo acá sugeriría que es esto lo que protege el dato.
 */
export async function getOwnReview(
  client: ReviewsClient,
  courseTeacherId: string
): Promise<OwnReview | null> {
  const { data, error } = await client
    .from('reviews')
    .select(
      'id, rating, recommends, comment, published_at, comment_published_at, comment_edited_at'
    )
    .eq('course_teacher_id', courseTeacherId)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo cargar tu reseña: ${error.message}`);
  }

  if (!data) return null;

  return {
    id: data.id,
    rating: data.rating,
    recommends: data.recommends,
    comment: data.comment,
    publishedAt: data.published_at,
    commentPublishedAt: data.comment_published_at,
    commentEditedAt: data.comment_edited_at,
  };
}
