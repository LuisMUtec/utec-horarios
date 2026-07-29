import type { SupabaseClient } from '@supabase/supabase-js';
import { DUPLICATE_REVIEW_MESSAGE } from '@/lib/review-submit';
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

const OWN_REVIEW_COLUMNS =
  'id, rating, recommends, comment, published_at, comment_published_at, comment_edited_at';

type OwnReviewRow = Pick<
  Database['public']['Tables']['reviews']['Row'],
  | 'id'
  | 'rating'
  | 'recommends'
  | 'comment'
  | 'published_at'
  | 'comment_published_at'
  | 'comment_edited_at'
>;

function toOwnReview(row: OwnReviewRow): OwnReview {
  return {
    id: row.id,
    rating: row.rating,
    recommends: row.recommends,
    comment: row.comment,
    publishedAt: row.published_at,
    commentPublishedAt: row.comment_published_at,
    commentEditedAt: row.comment_edited_at,
  };
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
    .select(OWN_REVIEW_COLUMNS)
    .eq('course_teacher_id', courseTeacherId)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo cargar tu reseña: ${error.message}`);
  }

  return data === null ? null : toOwnReview(data);
}

/**
 * Los tres rechazos esperables al publicar. Ninguno es una excepción: cada uno
 * tiene una pantalla y un código que la UI necesita distinguir —«ya reseñaste
 * este par» no se parece en nada a «alcanzaste el límite»—.
 */
export type ReviewRejection =
  /** FR-027, escenario 16. */
  | { code: 'duplicate'; message: string }
  /** FR-030. `releaseAt` es el instante de FR-031, en ISO. */
  | { code: 'rate_limit'; message: string; releaseAt: string | null }
  /** FR-028: el par salió de la oferta entre que se pintó la UI y se publicó. */
  | { code: 'not_current'; message: string };

export type CreateReviewResult =
  | { ok: true; review: OwnReview }
  | { ok: false; rejection: ReviewRejection };

/**
 * El instante de liberación viaja dentro del mensaje del trigger, que es el
 * único que sabe cuál es: cuenta también las reseñas eliminadas, que el autor
 * ya no puede leer (edge case *Límite de publicación*).
 *
 * `to_char(..., 'OF')` escribe el desfase en horas —`+00`, `-05`— y esa forma no
 * es una fecha válida en JavaScript, así que se completa a `+00:00` antes de
 * devolverla. Si el formato cambia se devuelve `null` y manda el mensaje del
 * trigger, que ya está en español y ya trae la hora.
 */
export function parseReleaseAt(message: string): string | null {
  const match = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})([+-]\d{2})(?::?(\d{2}))?/.exec(message);
  if (match === null) return null;

  const [, instant, hours, minutes = '00'] = match;
  const at = new Date(`${instant}${hours}:${minutes}`);

  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

/** Postgres: violación de unicidad y violación de check. */
const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';

/**
 * Traduce el rechazo de la base a algo que la UI pueda mostrar y distinguir.
 *
 * Los dos triggers que pueden cortar un insert levantan `check_violation`, así
 * que se separan por su mensaje. Es acoplamiento a un texto nuestro, no a uno
 * de Postgres, y `supabase/tests/resenas_reglas.test.sql` lo fija.
 */
function toRejection(error: { code?: string; message: string }): ReviewRejection | null {
  if (error.code === UNIQUE_VIOLATION) {
    return { code: 'duplicate', message: DUPLICATE_REVIEW_MESSAGE };
  }

  if (error.code !== CHECK_VIOLATION) return null;

  const releaseAt = parseReleaseAt(error.message);
  if (releaseAt !== null || error.message.includes('límite')) {
    return { code: 'rate_limit', message: error.message, releaseAt };
  }

  if (error.message.includes('oferta vigente')) {
    return { code: 'not_current', message: error.message };
  }

  return null;
}

/**
 * Publica una reseña (FR-021, FR-061). El `declared_attendance` va en `true`
 * fijo: la columna lleva un check que no acepta otra cosa, y la validación de
 * `review-submit.ts` ya exigió la casilla.
 *
 * Nada de esto es la frontera: la unicidad, el límite de 24 horas y el par
 * vigente los imponen el índice y los triggers. Acá solo se traduce su rechazo.
 */
export async function createReview(
  client: ReviewsClient,
  authorId: string,
  courseTeacherId: string,
  submission: { rating: number; recommends: boolean }
): Promise<CreateReviewResult> {
  const { data, error } = await client
    .from('reviews')
    .insert({
      author_id: authorId,
      course_teacher_id: courseTeacherId,
      rating: submission.rating,
      recommends: submission.recommends,
      declared_attendance: true,
    })
    .select(OWN_REVIEW_COLUMNS)
    .single();

  if (error) {
    const rejection = toRejection(error);
    if (rejection !== null) return { ok: false, rejection };

    throw new Error(`No se pudo publicar la reseña: ${error.message}`);
  }

  return { ok: true, review: toOwnReview(data) };
}
