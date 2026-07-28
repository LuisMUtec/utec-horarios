-- R2: la Data API sigue alcanzable con la publishable key, así que un error en
-- una política es una fuga aunque todos los handlers estén bien.
begin;
-- pgtap solo existe dentro de la transacción del test: el rollback se la lleva
-- y `supabase db push` nunca la instala en producción.
create extension if not exists pgtap with schema extensions;
set local search_path to extensions, public;

select plan(18);

-- Fixtures propias, y los conteos acotados a TEST101: el test tiene que decir
-- la verdad aunque alguien cambie supabase/seed.sql.
insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'a1@utec.edu.pe'),
  ('00000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', 'a2@utec.edu.pe'),
  ('00000000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', 'a3@utec.edu.pe');

update public.profiles set career_id = (select id from public.careers limit 1), term = 5
where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2');

update public.profiles set banned_at = now(), ban_reason = 'Insultos a un docente.'
where id = '00000000-0000-0000-0000-0000000000a3';

insert into public.course_teachers (id, course_code, teacher_email, teacher_name) values
  ('00000000-0000-0000-0000-0000000000c1', 'TEST101', 'docente@utec.edu.pe', 'Docente de Prueba');

insert into public.reviews (id, author_id, course_teacher_id, rating, recommends, comment,
                            declared_attendance, respect_acknowledged) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-0000000000c1', 5, true, 'Comentario de a1.', true, true),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a2',
   '00000000-0000-0000-0000-0000000000c1', 2, false, 'Comentario de a2.', true, true);

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------
set local role anon;

-- Más fuerte que devolver cero filas: sin grant, anon ni siquiera llega a RLS.
select throws_ok(
  'select id from public.reviews',
  '42501', null,
  'anon no puede tocar reviews'
);

select isnt_empty(
  $$select course_teacher_id from public.teacher_course_summaries where course_code = 'TEST101'$$,
  'anon sí obtiene los resúmenes agregados (FR-008)'
);

select throws_ok(
  'select id from public.review_comments',
  '42501', null,
  'anon no puede leer comentarios: lo corta el grant (FR-013)'
);

-- ---------------------------------------------------------------------------
-- autenticado ajeno
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';

select results_eq(
  'select id from public.reviews',
  array['00000000-0000-0000-0000-0000000000f2'::uuid],
  'un autenticado solo ve su propia reseña, no la del otro'
);

select results_eq(
  $$select count(*)::int from public.review_comments where course_code = 'TEST101'$$,
  array[2],
  'sí ve los dos comentarios por la vista, incluido el ajeno'
);

-- La comprobación que la interfaz no da: se ve igual con author_id expuesto.
select hasnt_column(
  'public', 'review_comments', 'author_id',
  'review_comments no expone author_id (SC-006)'
);

-- Un update que RLS filtra no falla: no alcanza ninguna fila. Lo que hay que
-- comprobar es que la fila ajena quedó intacta.
select lives_ok(
  $$update public.reviews set rating = 1
    where id = '00000000-0000-0000-0000-0000000000f1'$$,
  'editar la reseña de otro no lanza error, simplemente no alcanza filas'
);

select is_empty(
  $$select id from public.reviews where id = '00000000-0000-0000-0000-0000000000f1'$$,
  'y ni siquiera la ve para intentarlo'
);

-- ---------------------------------------------------------------------------
-- reportante (FR-046)
-- ---------------------------------------------------------------------------
insert into public.review_reports (review_id, reporter_id, reason)
values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a2', 'spam');

select results_eq(
  $$select count(*)::int from public.review_comments where course_code = 'TEST101'$$,
  array[1],
  'quien reporta deja de ver esa reseña'
);

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select results_eq(
  $$select count(*)::int from public.review_comments where course_code = 'TEST101'$$,
  array[2],
  'y sigue visible para el resto hasta que haya decisión (SC-008)'
);

-- ---------------------------------------------------------------------------
-- baneado (FR-049, FR-050, FR-057)
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';

select is_empty(
  'select id from public.review_comments',
  'un baneado no lee comentarios'
);

select isnt_empty(
  $$select course_teacher_id from public.teacher_course_summaries where course_code = 'TEST101'$$,
  'pero conserva los resúmenes públicos (FR-050)'
);

select results_eq(
  'select ban_reason from public.profiles',
  array['Insultos a un docente.'::text],
  'y su propio motivo, que es lo que FR-057 le tiene que mostrar'
);

-- ---------------------------------------------------------------------------
-- el autor elimina su propia reseña (FR-039)
-- ---------------------------------------------------------------------------
-- Hecho COMO EL AUTOR y no como postgres: es la única forma de que RLS
-- participe. Un update directo aquí es imposible —la política de select se
-- aplica también a la fila resultante— y por eso eliminar pasa por la función.
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';

select throws_ok(
  $$update public.reviews set state = 'deleted_by_author'
    where id = '00000000-0000-0000-0000-0000000000f2'$$,
  '42501', null,
  'el autor no tiene grant sobre state: no puede transicionar su reseña a mano'
);

select lives_ok(
  $$select public.delete_own_review('00000000-0000-0000-0000-0000000000f2')$$,
  'y sí la elimina por la función (FR-039)'
);

select is_empty(
  $$select id from public.reviews where id = '00000000-0000-0000-0000-0000000000f2'$$,
  'tras eliminarla deja de verla su propio autor, como promete la política de privacidad'
);

select throws_ok(
  $$select public.delete_own_review('00000000-0000-0000-0000-0000000000f1')$$,
  null, null,
  'y no puede eliminar la reseña de otro'
);

-- ---------------------------------------------------------------------------
-- la reseña ajena nunca cambió
-- ---------------------------------------------------------------------------
reset role;

select results_eq(
  $$select rating::int from public.reviews where id = '00000000-0000-0000-0000-0000000000f1'$$,
  array[5],
  'nadie editó la reseña de otro'
);

select * from finish();
rollback;
