-- Los triggers de reviews y review_reports: las reglas que ninguna política ni
-- constraint alcanza porque cuentan filas, miran otra tabla o dependen del
-- estado anterior. Corre como postgres a propósito: acá se prueban las reglas,
-- no RLS (eso es resenas_rls.test.sql).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions, public;

select plan(37);

-- ---------------------------------------------------------------------------
-- Inventario
-- ---------------------------------------------------------------------------
-- Las aserciones de abajo prueban reglas concretas, así que un trigger que se
-- añade sin prueba —o uno que desaparece— no rompe ninguna. La lista sí.
select triggers_are('public', 'reviews',
  array['review_00_normalize', 'review_10_current_pair', 'review_20_daily_limit',
        'review_30_comment_profile', 'review_40_stamp_timestamps',
        'review_40_stamp_on_insert', 'review_50_purge_after'],
  'reviews tiene exactamente los siete triggers del diseño'
);

select triggers_are('public', 'review_reports', array['report_10_reportable'],
  'review_reports solo el de reportabilidad (FR-042)');

select triggers_are('public', 'profiles', array['profile_touch'],
  'profiles solo el de updated_at');

-- Sin triggers_are: la lista de auth.users la pone Supabase y cambia con la
-- versión del stack; lo nuestro es que el perfil se cree.
select has_trigger('auth', 'users', 'on_auth_user_created',
  'auth.users dispara la creación del perfil');

-- Fixtures propias en TEST301/TEST302: el seed ya tiene datos y un conteo sin
-- acotar mentiría en cuanto alguien lo toque.
insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-000000301001', 'authenticated', 'authenticated', 't301a1@utec.edu.pe'),
  ('00000000-0000-0000-0000-000000301002', 'authenticated', 'authenticated', 't301a2@utec.edu.pe'),
  ('00000000-0000-0000-0000-000000301003', 'authenticated', 'authenticated', 't301a3@utec.edu.pe'),
  ('00000000-0000-0000-0000-000000301004', 'authenticated', 'authenticated', 't301a4@utec.edu.pe'),
  ('00000000-0000-0000-0000-000000301005', 'authenticated', 'authenticated', 't301a5@utec.edu.pe'),
  ('00000000-0000-0000-0000-000000301006', 'authenticated', 'authenticated', 't301a6@utec.edu.pe'),
  ('00000000-0000-0000-0000-000000301007', 'authenticated', 'authenticated', 't301a7@utec.edu.pe'),
  ('00000000-0000-0000-0000-000000301008', 'authenticated', 'authenticated', 't301a8@utec.edu.pe'),
  ('00000000-0000-0000-0000-000000301009', 'authenticated', 'authenticated', 't301a9@utec.edu.pe');

-- El trigger cubre a quien firma después de que existe, y no a quien ya tenía
-- cuenta: esos usuarios se quedaron sin perfil y recibían un 503 en cada
-- handler restringido. La migración de backfill los alcanzó; esta aserción es
-- la que se rompe si mañana entran usuarios por otra vía que lo esquive.
select is_empty(
  $$select u.id from auth.users u
    left join public.profiles p on p.id = u.id
    where p.id is null$$,
  'ningún usuario se queda sin perfil'
);

-- Carrera propia: tomarla del seed ataría estas aserciones a lo que ese archivo
-- traiga ese día.
insert into public.careers (id, slug, name, faculty) values
  ('00000000-0000-0000-0000-000000301050', 'test301-carrera', 'Carrera TEST301', 'Facultad TEST301');

-- Los cuatro estados de perfil que mira FR-017. 301002 arranca sin nada.
update public.profiles set career_id = '00000000-0000-0000-0000-000000301050', term = 5
where id in ('00000000-0000-0000-0000-000000301001',
             '00000000-0000-0000-0000-000000301007');
update public.profiles set career_id = '00000000-0000-0000-0000-000000301050'
where id = '00000000-0000-0000-0000-000000301008';
update public.profiles set term = 5
where id = '00000000-0000-0000-0000-000000301009';

insert into public.course_teachers (id, course_code, teacher_email, teacher_name, is_current) values
  ('00000000-0000-0000-0000-000000301010', 'TEST301', 'd10@utec.edu.pe', 'Docente 10', true),
  ('00000000-0000-0000-0000-000000301012', 'TEST301', 'd12@utec.edu.pe', 'Docente 12', false),
  ('00000000-0000-0000-0000-000000301013', 'TEST301', 'd13@utec.edu.pe', 'Docente 13', true),
  ('00000000-0000-0000-0000-000000301014', 'TEST301', 'd14@utec.edu.pe', 'Docente 14', true),
  ('00000000-0000-0000-0000-000000301015', 'TEST301', 'd15@utec.edu.pe', 'Docente 15', true),
  ('00000000-0000-0000-0000-000000301016', 'TEST301', 'd16@utec.edu.pe', 'Docente 16', true),
  ('00000000-0000-0000-0000-000000301017', 'TEST301', 'd17@utec.edu.pe', 'Docente 17', true),
  ('00000000-0000-0000-0000-000000301018', 'TEST301', 'd18@utec.edu.pe', 'Docente 18', true),
  ('00000000-0000-0000-0000-000000301019', 'TEST301', 'd19@utec.edu.pe', 'Docente 19', true);

-- Nueve pares para llenar el cupo diario: el índice único parcial obliga a que
-- cada puntuación del mismo autor caiga en un par distinto.
insert into public.course_teachers (id, course_code, teacher_email, teacher_name)
select ('00000000-0000-0000-0000-0000003010' || lpad(n::text, 2, '0'))::uuid,
       'TEST302', 'lim' || n || '@utec.edu.pe', 'Docente Límite ' || n
from generate_series(20, 28) as n;

-- ---------------------------------------------------------------------------
-- FR-030, FR-031: límite de 8 puntuaciones en 24 horas
-- ---------------------------------------------------------------------------
-- La más antigua queda a 10 h, así el instante de liberación es now() + 14 h y
-- no un now() + 24 h que saldría igual aunque el trigger mirase cualquier fila.
insert into public.reviews (author_id, course_teacher_id, rating, recommends, declared_attendance, published_at)
select '00000000-0000-0000-0000-000000301003',
       ('00000000-0000-0000-0000-0000003010' || lpad(n::text, 2, '0'))::uuid,
       4, true, true, now() - interval '10 hours' + make_interval(mins => (n - 20) * 30)
from generate_series(20, 27) as n;

select throws_ok(
  $$insert into public.reviews (author_id, course_teacher_id, rating, recommends, declared_attendance)
    values ('00000000-0000-0000-0000-000000301003',
            '00000000-0000-0000-0000-000000301028', 3, true, true)$$,
  '23514', null,
  'la novena puntuación en 24 h no pasa (FR-030)'
);

select throws_like(
  $$insert into public.reviews (author_id, course_teacher_id, rating, recommends, declared_attendance)
    values ('00000000-0000-0000-0000-000000301003',
            '00000000-0000-0000-0000-000000301028', 3, true, true)$$,
  '%' || to_char(now() + interval '14 hours', 'YYYY-MM-DD"T"HH24:MI:SSOF') || '%',
  'y el mensaje trae el instante exacto de liberación (FR-031)'
);

-- Edge case "Límite de publicación": el cupo cuenta filas creadas.
update public.reviews set state = 'deleted_by_author'
where author_id = '00000000-0000-0000-0000-000000301003'
  and course_teacher_id = '00000000-0000-0000-0000-000000301020';

-- throws_like y no el 23514 pelado: los otros dos triggers de insert levantan
-- ese mismo sqlstate, así que solo el texto identifica al que se está probando.
select throws_like(
  $$insert into public.reviews (author_id, course_teacher_id, rating, recommends, declared_attendance)
    values ('00000000-0000-0000-0000-000000301003',
            '00000000-0000-0000-0000-000000301028', 3, true, true)$$,
  '%límite de 8 puntuaciones en 24 horas%',
  'eliminar una reseña no libera cupo dentro de la ventana'
);

insert into public.reviews (author_id, course_teacher_id, rating, recommends, declared_attendance, published_at)
select '00000000-0000-0000-0000-000000301004',
       ('00000000-0000-0000-0000-0000003010' || lpad(n::text, 2, '0'))::uuid,
       4, true, true, now() - interval '25 hours'
from generate_series(20, 27) as n;

select lives_ok(
  $$insert into public.reviews (author_id, course_teacher_id, rating, recommends, declared_attendance)
    values ('00000000-0000-0000-0000-000000301004',
            '00000000-0000-0000-0000-000000301028', 3, true, true)$$,
  'pero las de hace más de 24 h ya no ocupan cupo'
);

-- ---------------------------------------------------------------------------
-- FR-027: una sola reseña activa por par
-- ---------------------------------------------------------------------------
insert into public.reviews (id, author_id, course_teacher_id, rating, recommends, declared_attendance)
values ('00000000-0000-0000-0000-000000301030', '00000000-0000-0000-0000-000000301001',
        '00000000-0000-0000-0000-000000301010', 5, true, true);

-- Nombrar el índice: un 23505 a secas lo daría cualquier otra unicidad.
select throws_like(
  $$insert into public.reviews (author_id, course_teacher_id, rating, recommends, declared_attendance)
    values ('00000000-0000-0000-0000-000000301001',
            '00000000-0000-0000-0000-000000301010', 1, false, true)$$,
  '%reviews_one_active_per_pair%',
  'una segunda reseña activa del mismo par no pasa (FR-027)'
);

update public.reviews set state = 'deleted_by_author'
where id = '00000000-0000-0000-0000-000000301030';

select lives_ok(
  $$insert into public.reviews (id, author_id, course_teacher_id, rating, recommends, declared_attendance)
    values ('00000000-0000-0000-0000-000000301031', '00000000-0000-0000-0000-000000301001',
            '00000000-0000-0000-0000-000000301010', 1, false, true)$$,
  'tras eliminarla, el mismo par se puede volver a reseñar'
);

-- ---------------------------------------------------------------------------
-- Normalización del comentario
-- ---------------------------------------------------------------------------
insert into public.reviews (id, author_id, course_teacher_id, rating, recommends, comment,
                            declared_attendance, respect_acknowledged)
values ('00000000-0000-0000-0000-000000301032', '00000000-0000-0000-0000-000000301001',
        '00000000-0000-0000-0000-000000301016', 4, true, '   ', true, true);

-- results_eq y no is(): con is(), una fila ausente daría null y la aserción
-- pasaría sin haber mirado nada. Vale para todas las de abajo que esperan null.
select results_eq(
  $$select comment from public.reviews where id = '00000000-0000-0000-0000-000000301032'$$,
  array[null::text],
  'un comentario de solo espacios queda como reseña sin comentario'
);

-- ---------------------------------------------------------------------------
-- FR-017: carrera y ciclo se exigen para comentar, no para puntuar
-- ---------------------------------------------------------------------------
-- El mensaje va en la aserción: con el 23514 pelado, el check
-- comment_needs_acknowledgement o el trigger de oferta vigente la darían por
-- buena sin que el de FR-017 llegara a correr.
select throws_ok(
  $$insert into public.reviews (author_id, course_teacher_id, rating, recommends, comment,
                                declared_attendance, respect_acknowledged)
    values ('00000000-0000-0000-0000-000000301002',
            '00000000-0000-0000-0000-000000301017', 4, true, 'Sin carrera ni ciclo.', true, true)$$,
  '23514', 'Completa tu carrera y tu ciclo antes de escribir un comentario.',
  'sin carrera ni ciclo no se puede comentar (FR-017)'
);

-- Los dos perfiles a medias: con solo el caso de arriba, un trigger que mirara
-- únicamente career_id (o únicamente term) pasaría igual.
select throws_ok(
  $$insert into public.reviews (author_id, course_teacher_id, rating, recommends, comment,
                                declared_attendance, respect_acknowledged)
    values ('00000000-0000-0000-0000-000000301008',
            '00000000-0000-0000-0000-000000301018', 4, true, 'Con carrera, sin ciclo.', true, true)$$,
  '23514', 'Completa tu carrera y tu ciclo antes de escribir un comentario.',
  'con carrera pero sin ciclo tampoco (FR-017)'
);

select throws_ok(
  $$insert into public.reviews (author_id, course_teacher_id, rating, recommends, comment,
                                declared_attendance, respect_acknowledged)
    values ('00000000-0000-0000-0000-000000301009',
            '00000000-0000-0000-0000-000000301019', 4, true, 'Con ciclo, sin carrera.', true, true)$$,
  '23514', 'Completa tu carrera y tu ciclo antes de escribir un comentario.',
  'con ciclo pero sin carrera tampoco (FR-017)'
);

select lives_ok(
  $$insert into public.reviews (id, author_id, course_teacher_id, rating, recommends, declared_attendance)
    values ('00000000-0000-0000-0000-000000301034', '00000000-0000-0000-0000-000000301002',
            '00000000-0000-0000-0000-000000301017', 4, true, true)$$,
  'con el mismo perfil incompleto sí puede puntuar (SC-003)'
);

select throws_ok(
  $$update public.reviews set comment = 'Agregado después.', respect_acknowledged = true
    where id = '00000000-0000-0000-0000-000000301034'$$,
  '23514', 'Completa tu carrera y tu ciclo antes de escribir un comentario.',
  'ni agregar el comentario en un update posterior'
);

update public.profiles set career_id = '00000000-0000-0000-0000-000000301050', term = 3
where id = '00000000-0000-0000-0000-000000301002';

select lives_ok(
  $$update public.reviews set comment = 'Agregado después.', respect_acknowledged = true
    where id = '00000000-0000-0000-0000-000000301034'$$,
  'y con el perfil completo ese mismo update pasa'
);

-- ---------------------------------------------------------------------------
-- FR-028: la oferta vigente
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into public.reviews (author_id, course_teacher_id, rating, recommends, declared_attendance)
    values ('00000000-0000-0000-0000-000000301001',
            '00000000-0000-0000-0000-000000301012', 4, true, true)$$,
  '23514', 'Ese docente ya no dicta este curso en la oferta vigente.',
  'un par que ya no está vigente no admite reseñas (FR-028)'
);

-- ---------------------------------------------------------------------------
-- FR-064, FR-055: sellos del comentario
-- ---------------------------------------------------------------------------
insert into public.reviews (id, author_id, course_teacher_id, rating, recommends,
                            declared_attendance, published_at)
values ('00000000-0000-0000-0000-000000301033', '00000000-0000-0000-0000-000000301001',
        '00000000-0000-0000-0000-000000301013', 3, true, true, now() - interval '5 days');

select results_eq(
  $$select comment_published_at from public.reviews where id = '00000000-0000-0000-0000-000000301033'$$,
  array[null::timestamptz],
  'una reseña creada sin comentario no sella comment_published_at (FR-064)'
);

update public.reviews set comment = 'Primera versión.', respect_acknowledged = true
where id = '00000000-0000-0000-0000-000000301033';

select isnt(
  (select comment_published_at from public.reviews where id = '00000000-0000-0000-0000-000000301033'),
  null::timestamptz,
  'al añadir el texto se sella comment_published_at'
);

select results_eq(
  $$select comment_edited_at from public.reviews where id = '00000000-0000-0000-0000-000000301033'$$,
  array[null::timestamptz],
  'y comment_edited_at sigue vacío: publicar no es editar (FR-055)'
);

-- Los sellos viejos van puestos desde el insert: now() es constante en la
-- transacción, así que sin fechas distintas un resello indebido daría el mismo
-- valor y las dos aserciones de abajo no probarían nada.
insert into public.reviews (id, author_id, course_teacher_id, rating, recommends, comment,
                            declared_attendance, respect_acknowledged,
                            published_at, comment_published_at)
values ('00000000-0000-0000-0000-000000301035', '00000000-0000-0000-0000-000000301007',
        '00000000-0000-0000-0000-000000301015', 4, true, 'Primera versión.', true, true,
        now() - interval '5 days', now() - interval '3 days');

update public.reviews set comment = 'Segunda versión.'
where id = '00000000-0000-0000-0000-000000301035';

select isnt(
  (select comment_edited_at from public.reviews where id = '00000000-0000-0000-0000-000000301035'),
  null::timestamptz,
  'cambiar el texto sí marca comment_edited_at (FR-055)'
);

select is(
  (select comment_published_at from public.reviews where id = '00000000-0000-0000-0000-000000301035'),
  now() - interval '3 days',
  'y no vuelve a sellar comment_published_at (FR-064)'
);

-- Alcance real: ningún trigger toca published_at. Que el autor no pueda
-- moverlo por su cuenta no lo garantiza nada del esquema; ver el veredicto.
select is(
  (select published_at from public.reviews where id = '00000000-0000-0000-0000-000000301035'),
  now() - interval '5 days',
  'editar el comentario no mueve published_at (FR-033)'
);

insert into public.reviews (id, author_id, course_teacher_id, rating, recommends, comment,
                            declared_attendance, respect_acknowledged)
values ('00000000-0000-0000-0000-000000301040', '00000000-0000-0000-0000-000000301007',
        '00000000-0000-0000-0000-000000301014', 2, false, 'Comentario reportable.', true, true);

select is(
  (select comment_published_at from public.reviews where id = '00000000-0000-0000-0000-000000301040'),
  now(),
  'una reseña creada con comentario trae el sello desde el insert'
);

-- ---------------------------------------------------------------------------
-- purge_after: los 30 días de retención
-- ---------------------------------------------------------------------------
select results_eq(
  $$select purge_after from public.reviews where id = '00000000-0000-0000-0000-000000301031'$$,
  array[null::timestamptz],
  'una reseña activa no tiene fecha de purga'
);

update public.reviews set state = 'deleted_by_author'
where id = '00000000-0000-0000-0000-000000301031';

select ok(
  (select purge_after between now() + interval '29 days' and now() + interval '31 days'
   from public.reviews where id = '00000000-0000-0000-0000-000000301031'),
  'al salir de activa se sella purge_after a unos 30 días'
);

-- Un valor distinto de now() + 30 días: si el trigger resellara en cada update
-- de una fila ya eliminada, el reloj de retención se reiniciaría solo.
update public.reviews set purge_after = now() + interval '3 days'
where id = '00000000-0000-0000-0000-000000301031';

update public.reviews set state = 'removed_by_moderation'
where id = '00000000-0000-0000-0000-000000301031';

select is(
  (select purge_after from public.reviews where id = '00000000-0000-0000-0000-000000301031'),
  now() + interval '3 days',
  'y no se resella al tocar una reseña que ya estaba fuera de activa'
);

-- ---------------------------------------------------------------------------
-- FR-042, FR-044, FR-045, FR-052: reportes
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into public.review_reports (review_id, reporter_id, reason)
    values ('00000000-0000-0000-0000-000000301032',
            '00000000-0000-0000-0000-000000301005', 'spam')$$,
  '23514', 'Esa reseña no se puede reportar.',
  'una reseña sin comentario no se puede reportar (FR-042)'
);

-- La otra mitad del trigger: sin esto, quitarle el state = 'active' no rompería
-- ninguna aserción. 301033 sí tiene comentario, así que solo el estado decide.
update public.reviews set state = 'deleted_by_author'
where id = '00000000-0000-0000-0000-000000301033';

select throws_ok(
  $$insert into public.review_reports (review_id, reporter_id, reason)
    values ('00000000-0000-0000-0000-000000301033',
            '00000000-0000-0000-0000-000000301005', 'spam')$$,
  '23514', 'Esa reseña no se puede reportar.',
  'una eliminada tampoco, aunque tenga comentario (FR-042)'
);

select lives_ok(
  $$insert into public.review_reports (review_id, reporter_id, reason)
    values ('00000000-0000-0000-0000-000000301040',
            '00000000-0000-0000-0000-000000301005', 'insult')$$,
  'una activa con comentario sí (FR-052)'
);

select throws_like(
  $$insert into public.review_reports (review_id, reporter_id, reason)
    values ('00000000-0000-0000-0000-000000301040',
            '00000000-0000-0000-0000-000000301006', 'other')$$,
  '%other_needs_details%',
  'el motivo "other" exige detalle (FR-044)'
);

select throws_like(
  $$insert into public.review_reports (review_id, reporter_id, reason, details)
    values ('00000000-0000-0000-0000-000000301040',
            '00000000-0000-0000-0000-000000301006', 'other', '   ')$$,
  '%other_needs_details%',
  'y un detalle en blanco no cuenta como detalle'
);

select throws_like(
  $$insert into public.review_reports (review_id, reporter_id, reason)
    values ('00000000-0000-0000-0000-000000301040',
            '00000000-0000-0000-0000-000000301005', 'spam')$$,
  '%review_reports_review_id_reporter_id_key%',
  'el mismo reportante no reporta dos veces la misma reseña (FR-045)'
);

select lives_ok(
  $$insert into public.review_reports (review_id, reporter_id, reason, details)
    values ('00000000-0000-0000-0000-000000301040',
            '00000000-0000-0000-0000-000000301006', 'other', 'Expone datos de un tercero.')$$,
  'pero otra persona sí puede reportarla'
);

-- ---------------------------------------------------------------------------
-- updated_at del perfil
-- ---------------------------------------------------------------------------
-- El sello viejo hay que ponerlo con el trigger apagado: encendido reescribe
-- updated_at en el mismo update que intentara envejecerlo, y la aserción pasaría
-- con el trigger haciendo nada.
alter table public.profiles disable trigger profile_touch;
update public.profiles set updated_at = now() - interval '5 days'
where id = '00000000-0000-0000-0000-000000301001';
alter table public.profiles enable trigger profile_touch;

update public.profiles set term = 9
where id = '00000000-0000-0000-0000-000000301001';

select is(
  (select updated_at from public.profiles where id = '00000000-0000-0000-0000-000000301001'),
  now(),
  'cambiar el perfil refresca updated_at'
);

select * from finish();
rollback;
