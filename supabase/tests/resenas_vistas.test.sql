-- Las dos vistas públicas son el único cálculo del producto: si el promedio o el
-- porcentaje salen mal, no hay capa después que lo corrija.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions, public;

select plan(22);

-- Todo acotado a TEST201: supabase/seed.sql ya tiene cursos y reseñas propias.
insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-0000002010a1', 'authenticated', 'authenticated', 'v1@utec.edu.pe'),
  ('00000000-0000-0000-0000-0000002010a2', 'authenticated', 'authenticated', 'v2@utec.edu.pe'),
  ('00000000-0000-0000-0000-0000002010a3', 'authenticated', 'authenticated', 'v3@utec.edu.pe');

update public.profiles set career_id = (select id from public.careers limit 1), term = 5
where id in ('00000000-0000-0000-0000-0000002010a1',
             '00000000-0000-0000-0000-0000002010a2',
             '00000000-0000-0000-0000-0000002010a3');

insert into public.course_teachers (id, course_code, teacher_email, teacher_name) values
  ('00000000-0000-0000-0000-0000002010c1', 'TEST201', 'v-uno@utec.edu.pe', 'Docente Uno'),
  ('00000000-0000-0000-0000-0000002010c2', 'TEST201', 'v-dos@utec.edu.pe', 'Docente Dos'),
  ('00000000-0000-0000-0000-0000002010c3', 'TEST201', 'v-tres@utec.edu.pe', 'Docente Tres'),
  ('00000000-0000-0000-0000-0000002010c4', 'TEST201', 'v-cuatro@utec.edu.pe', 'Docente Cuatro');

-- c1: 5,4,4 -> 4.3; 2 de 3 recomiendan -> 67; un solo comentario de tres reseñas.
-- La tercera lleva comentario en blanco: el trigger de normalización lo deja en
-- NULL y por eso no cuenta ni se ve.
insert into public.reviews (id, author_id, course_teacher_id, rating, recommends, comment,
                            declared_attendance, respect_acknowledged) values
  ('00000000-0000-0000-0000-0000002010f1', '00000000-0000-0000-0000-0000002010a1',
   '00000000-0000-0000-0000-0000002010c1', 5, true, 'Explica muy bien.', true, true),
  ('00000000-0000-0000-0000-0000002010f2', '00000000-0000-0000-0000-0000002010a2',
   '00000000-0000-0000-0000-0000002010c1', 4, true, null, true, false),
  ('00000000-0000-0000-0000-0000002010f3', '00000000-0000-0000-0000-0000002010a3',
   '00000000-0000-0000-0000-0000002010c1', 4, false, '   ', true, true),
  ('00000000-0000-0000-0000-0000002010f4', '00000000-0000-0000-0000-0000002010a1',
   '00000000-0000-0000-0000-0000002010c2', 3, true, 'Comentario del par que se retira.', true, true),
  ('00000000-0000-0000-0000-0000002010f5', '00000000-0000-0000-0000-0000002010a2',
   '00000000-0000-0000-0000-0000002010c2', 5, true, null, true, false),
  ('00000000-0000-0000-0000-0000002010f6', '00000000-0000-0000-0000-0000002010a1',
   '00000000-0000-0000-0000-0000002010c3', 1, false, null, true, false),
  -- c4: dos comentarios vivos, para poder distinguir "se fue este" de "se fue todo".
  ('00000000-0000-0000-0000-0000002010f7', '00000000-0000-0000-0000-0000002010a1',
   '00000000-0000-0000-0000-0000002010c4', 2, false, 'Comentario que se elimina.', true, true),
  ('00000000-0000-0000-0000-0000002010f8', '00000000-0000-0000-0000-0000002010a3',
   '00000000-0000-0000-0000-0000002010c4', 4, true, 'Comentario que sobrevive.', true, true);

-- ---------------------------------------------------------------------------
-- agregados (FR-003, FR-005, FR-006, FR-059)
-- ---------------------------------------------------------------------------

-- Como texto: el promedio crudo es 4.3333..., así que esto falla si falta el round.
select results_eq(
  $$select average_rating::text from public.teacher_course_summaries
    where course_teacher_id = '00000000-0000-0000-0000-0000002010c1'$$,
  array['4.3'::text],
  'el promedio sale con un decimal en escala 1..5 (FR-003)'
);

select col_type_is(
  'public', 'teacher_course_summaries', 'recommend_percentage', 'integer',
  'el porcentaje es entero, sin decimales (FR-059)'
);

select results_eq(
  $$select recommend_percentage from public.teacher_course_summaries
    where course_teacher_id = '00000000-0000-0000-0000-0000002010c1'$$,
  array[67],
  '2 de 3 recomendaciones sobre el total de reseñas activas es 67 (FR-059)'
);

select results_eq(
  $$select rating_count, comment_count from public.teacher_course_summaries
    where course_teacher_id = '00000000-0000-0000-0000-0000002010c1'$$,
  $$values (3::bigint, 1::bigint)$$,
  'las puntuaciones cuentan las tres reseñas y los comentarios solo el que tiene texto (FR-005, FR-006)'
);

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000002010a1","role":"authenticated"}';

select is_empty(
  $$select id from public.review_comments
    where id = '00000000-0000-0000-0000-0000002010f3'$$,
  'un comentario de solo espacios no llega a la vista de comentarios'
);

-- ---------------------------------------------------------------------------
-- superficie de las vistas (FR-008, FR-013, SC-006)
-- ---------------------------------------------------------------------------
select hasnt_column(
  'public', 'review_comments', 'author_id',
  'review_comments no expone author_id'
);

reset role;
set local role anon;

select isnt_empty(
  $$select course_teacher_id from public.teacher_course_summaries where course_code = 'TEST201'$$,
  'anon lee los resúmenes agregados (FR-008)'
);

select throws_ok(
  'select id from public.review_comments',
  '42501', null,
  'anon no lee comentarios: no tiene grant sobre la vista (FR-013)'
);

-- ---------------------------------------------------------------------------
-- R6: un par retirado de la oferta desaparece de las dos vistas
-- ---------------------------------------------------------------------------
reset role;

select isnt_empty(
  $$select course_teacher_id from public.teacher_course_summaries
    where course_teacher_id = '00000000-0000-0000-0000-0000002010c2'$$,
  'mientras el par está vigente aparece en el resumen'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000002010a1","role":"authenticated"}';

select results_eq(
  $$select count(*)::int from public.review_comments
    where course_teacher_id = '00000000-0000-0000-0000-0000002010c2'$$,
  array[1],
  'y su comentario también'
);

reset role;
update public.course_teachers set is_current = false
where id = '00000000-0000-0000-0000-0000002010c2';

select is_empty(
  $$select course_teacher_id from public.teacher_course_summaries
    where course_teacher_id = '00000000-0000-0000-0000-0000002010c2'$$,
  'retirado el par, se va del resumen (R6)'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000002010a1","role":"authenticated"}';

select is_empty(
  $$select id from public.review_comments
    where course_teacher_id = '00000000-0000-0000-0000-0000002010c2'$$,
  'y también de los comentarios (R6)'
);

reset role;

select results_eq(
  $$select count(*)::int from public.reviews
    where course_teacher_id = '00000000-0000-0000-0000-0000002010c2' and state = 'active'$$,
  array[2],
  'pero sus reseñas siguen guardadas y activas (R6)'
);

-- ---------------------------------------------------------------------------
-- eliminación por el autor (FR-040, SC-005)
-- ---------------------------------------------------------------------------
-- El cambio de estado va como postgres: acá se prueba la vista, no la política.
update public.reviews set state = 'deleted_by_author'
where id = '00000000-0000-0000-0000-0000002010f3';

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000002010a3","role":"authenticated"}';

-- La consulta siguiente, sin refresco de por medio: 5,4 -> 4.5 y 2 de 2 -> 100.
select results_eq(
  $$select average_rating::text, rating_count, recommend_percentage
    from public.teacher_course_summaries
    where course_teacher_id = '00000000-0000-0000-0000-0000002010c1'$$,
  $$values ('4.5'::text, 2::bigint, 100)$$,
  'la reseña eliminada sale del promedio y de los conteos en la consulta siguiente (FR-040, SC-005)'
);

reset role;

select isnt_empty(
  $$select course_teacher_id from public.teacher_course_summaries
    where course_teacher_id = '00000000-0000-0000-0000-0000002010c3'$$,
  'una sola reseña ya pone al par en el resumen'
);

update public.reviews set state = 'deleted_by_author'
where id = '00000000-0000-0000-0000-0000002010f6';

select is_empty(
  $$select course_teacher_id from public.teacher_course_summaries
    where course_teacher_id = '00000000-0000-0000-0000-0000002010c3'$$,
  'eliminada la única reseña del par, el par desaparece del resumen'
);

-- El estado filtra las dos vistas: sin esto, el texto de una reseña eliminada
-- seguiría publicado aunque el resumen ya no la cuente (FR-040).
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000002010a2","role":"authenticated"}';

select results_eq(
  $$select id from public.review_comments
    where course_teacher_id = '00000000-0000-0000-0000-0000002010c4' order by id$$,
  $$values ('00000000-0000-0000-0000-0000002010f7'::uuid),
           ('00000000-0000-0000-0000-0000002010f8'::uuid)$$,
  'los dos comentarios del par están a la vista antes de eliminar'
);

reset role;
update public.reviews set state = 'deleted_by_author'
where id = '00000000-0000-0000-0000-0000002010f7';

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000002010a2","role":"authenticated"}';

select results_eq(
  $$select id from public.review_comments
    where course_teacher_id = '00000000-0000-0000-0000-0000002010c4'$$,
  array['00000000-0000-0000-0000-0000002010f8'::uuid],
  'la eliminada sale de review_comments y la otra se queda (FR-040)'
);

-- ---------------------------------------------------------------------------
-- FR-046: el reporte oculta solo para quien reporta
-- ---------------------------------------------------------------------------

insert into public.review_reports (review_id, reporter_id, reason) values
  ('00000000-0000-0000-0000-0000002010f1', '00000000-0000-0000-0000-0000002010a2', 'spam');

select is_empty(
  $$select id from public.review_comments
    where course_teacher_id = '00000000-0000-0000-0000-0000002010c1'$$,
  'quien reportó deja de ver ese comentario mientras el reporte sigue pendiente (FR-046)'
);

-- Sin esta, un filtro que escondiera todo a quien haya reportado algo pasaría igual.
select results_eq(
  $$select id from public.review_comments
    where course_teacher_id = '00000000-0000-0000-0000-0000002010c4'$$,
  array['00000000-0000-0000-0000-0000002010f8'::uuid],
  'pero sigue viendo los demás comentarios: se oculta la reseña reportada, no la vista (FR-046)'
);

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000002010a1","role":"authenticated"}';

select results_eq(
  $$select count(*)::int from public.review_comments
    where course_teacher_id = '00000000-0000-0000-0000-0000002010c1'$$,
  array[1],
  'y para el resto sigue visible hasta que haya decisión (FR-046)'
);

-- Resuelto el reporte se acaba el ocultamiento: es `pending` lo que oculta, no el reporte.
reset role;
update public.review_reports set status = 'kept', resolved_at = now()
where review_id = '00000000-0000-0000-0000-0000002010f1'
  and reporter_id = '00000000-0000-0000-0000-0000002010a2';

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000002010a2","role":"authenticated"}';

select results_eq(
  $$select count(*)::int from public.review_comments
    where course_teacher_id = '00000000-0000-0000-0000-0000002010c1'$$,
  array[1],
  'y con el reporte resuelto vuelve a verlo quien lo reportó (FR-046)'
);

select * from finish();
rollback;
