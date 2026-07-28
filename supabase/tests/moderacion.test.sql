-- Las funciones de private solo se invocan desde Studio (FR-051): nadie las
-- ejercita en el camino normal, así que su único control es este archivo.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions, public;

select plan(23);

-- Fixtures propias en TEST401 y todo acotado a ellas: seed.sql ya llenó la base.
insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-000000401001', 'authenticated', 'authenticated', 'm01@utec.edu.pe'),
  ('00000000-0000-0000-0000-000000401002', 'authenticated', 'authenticated', 'm02@utec.edu.pe'),
  ('00000000-0000-0000-0000-000000401003', 'authenticated', 'authenticated', 'm03@utec.edu.pe'),
  ('00000000-0000-0000-0000-000000401004', 'authenticated', 'authenticated', 'm04@utec.edu.pe'),
  ('00000000-0000-0000-0000-000000401005', 'authenticated', 'authenticated', 'm05@utec.edu.pe'),
  ('00000000-0000-0000-0000-000000401006', 'authenticated', 'authenticated', 'm06@utec.edu.pe');

update public.profiles set career_id = (select id from public.careers limit 1), term = 7
where id::text like '00000000-0000-0000-0000-0000004010%';

update public.profiles set banned_at = now(), ban_reason = 'Reincidencia tras una sanción.'
where id = '00000000-0000-0000-0000-000000401006';

-- Un par por escenario: así ningún conteo del resumen depende de otro caso.
insert into public.course_teachers (id, course_code, teacher_email, teacher_name) values
  ('00000000-0000-0000-0000-0000004010c1', 'TEST401', 'm-d1@utec.edu.pe', 'Docente 401-1'),
  ('00000000-0000-0000-0000-0000004010c2', 'TEST401', 'm-d2@utec.edu.pe', 'Docente 401-2'),
  ('00000000-0000-0000-0000-0000004010c3', 'TEST401', 'm-d3@utec.edu.pe', 'Docente 401-3'),
  ('00000000-0000-0000-0000-0000004010c4', 'TEST401', 'm-d4@utec.edu.pe', 'Docente 401-4'),
  ('00000000-0000-0000-0000-0000004010c5', 'TEST401', 'm-d5@utec.edu.pe', 'Docente 401-5'),
  ('00000000-0000-0000-0000-0000004010c6', 'TEST401', 'm-d6@utec.edu.pe', 'Docente 401-6');

insert into public.reviews (id, author_id, course_teacher_id, rating, recommends, comment,
                            declared_attendance, respect_acknowledged) values
  ('00000000-0000-0000-0000-0000004010f1', '00000000-0000-0000-0000-000000401001',
   '00000000-0000-0000-0000-0000004010c1', 5, true,  'Reseña que se conserva.',   true, true),
  -- Acompaña a f1 con otra nota: un par de una sola reseña de 5 daría promedio 5
  -- aunque el resumen calculara cualquier otra cosa.
  ('00000000-0000-0000-0000-0000004010f8', '00000000-0000-0000-0000-000000401002',
   '00000000-0000-0000-0000-0000004010c1', 2, false, null,                        true, false),
  ('00000000-0000-0000-0000-0000004010f2', '00000000-0000-0000-0000-000000401003',
   '00000000-0000-0000-0000-0000004010c2', 1, false, 'Reseña que se elimina.',    true, true),
  ('00000000-0000-0000-0000-0000004010f3', '00000000-0000-0000-0000-000000401001',
   '00000000-0000-0000-0000-0000004010c2', 4, true,  null,                        true, false),
  ('00000000-0000-0000-0000-0000004010f4', '00000000-0000-0000-0000-000000401004',
   '00000000-0000-0000-0000-0000004010c3', 2, false, 'Reseña reportada del par 3.', true, true),
  -- Sin reporte y en otro par: es la que se queda viva si el baneo solo mira la reportada.
  ('00000000-0000-0000-0000-0000004010f5', '00000000-0000-0000-0000-000000401004',
   '00000000-0000-0000-0000-0000004010c4', 4, true,  null,                        true, false),
  ('00000000-0000-0000-0000-0000004010f6', '00000000-0000-0000-0000-000000401005',
   '00000000-0000-0000-0000-0000004010c5', 3, true,  null,                        true, false),
  ('00000000-0000-0000-0000-0000004010f7', '00000000-0000-0000-0000-000000401005',
   '00000000-0000-0000-0000-0000004010c6', 5, true,  null,                        true, false);

insert into public.review_reports (id, review_id, reporter_id, reason) values
  ('00000000-0000-0000-0000-0000004010e1', '00000000-0000-0000-0000-0000004010f1',
   '00000000-0000-0000-0000-000000401002', 'spam'),
  ('00000000-0000-0000-0000-0000004010e2', '00000000-0000-0000-0000-0000004010f2',
   '00000000-0000-0000-0000-000000401002', 'insult'),
  ('00000000-0000-0000-0000-0000004010e3', '00000000-0000-0000-0000-0000004010f2',
   '00000000-0000-0000-0000-000000401001', 'false_content'),
  ('00000000-0000-0000-0000-0000004010e4', '00000000-0000-0000-0000-0000004010f4',
   '00000000-0000-0000-0000-000000401002', 'insult'),
  ('00000000-0000-0000-0000-0000004010e5', '00000000-0000-0000-0000-0000004010f1',
   '00000000-0000-0000-0000-000000401003', 'spam');

-- ---------------------------------------------------------------------------
-- moderation_keep (FR-047, escenario 33)
-- ---------------------------------------------------------------------------
select private.moderation_keep('00000000-0000-0000-0000-0000004010e1');

select results_eq(
  $$select status::text, resolved_at is not null from public.review_reports
    where id = '00000000-0000-0000-0000-0000004010e1'$$,
  $$values ('kept', true)$$,
  'conservar resuelve el reporte como kept'
);

select results_eq(
  $$select average_rating, rating_count from public.teacher_course_summaries
    where course_teacher_id = '00000000-0000-0000-0000-0000004010c1'$$,
  $$values (3.5::numeric, 2::bigint)$$,
  'y la reseña conservada sigue contando en el resumen'
);

select throws_ok(
  $$select private.moderation_keep('00000000-0000-0000-0000-0000004010e1')$$,
  'P0001', 'No hay un reporte pendiente con ese id.',
  'un reporte ya decidido no se vuelve a decidir'
);

-- ---------------------------------------------------------------------------
-- moderation_remove (FR-037, FR-048, escenario 36)
-- ---------------------------------------------------------------------------
select results_eq(
  $$select average_rating, rating_count from public.teacher_course_summaries
    where course_teacher_id = '00000000-0000-0000-0000-0000004010c2'$$,
  $$values (2.5::numeric, 2::bigint)$$,
  'antes de la decisión la reseña pesa en el promedio del par'
);

select private.moderation_remove('00000000-0000-0000-0000-0000004010e2');

select results_eq(
  $$select average_rating, rating_count from public.teacher_course_summaries
    where course_teacher_id = '00000000-0000-0000-0000-0000004010c2'$$,
  $$values (4.0::numeric, 1::bigint)$$,
  'eliminarla la saca del promedio y del conteo en la consulta siguiente (FR-048)'
);

select results_eq(
  $$select id, status::text from public.review_reports
    where review_id = '00000000-0000-0000-0000-0000004010f2' order by id$$,
  $$values ('00000000-0000-0000-0000-0000004010e2'::uuid, 'removed'),
          ('00000000-0000-0000-0000-0000004010e3'::uuid, 'removed')$$,
  'y resuelve todos los reportes pendientes de esa reseña, no solo el revisado'
);

-- El autor de la reseña eliminada intenta revivirla (FR-037).
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000401003","role":"authenticated"}';

-- Ni siquiera llega a RLS: `state` está fuera del grant de update del autor,
-- justamente para que resucitar no sea una operación que exista.
select throws_ok(
  $$update public.reviews set state = 'active'
    where id = '00000000-0000-0000-0000-0000004010f2'$$,
  '42501', null,
  'el autor no tiene privilegio para tocar el estado de su reseña eliminada'
);

reset role;

select results_eq(
  $$select state::text from public.reviews
    where id = '00000000-0000-0000-0000-0000004010f2'$$,
  $$values ('removed_by_moderation')$$,
  'ni el autor la devuelve a activa'
);

-- ---------------------------------------------------------------------------
-- moderation_ban (FR-050, FR-056, FR-057)
-- ---------------------------------------------------------------------------
-- El errcode distingue el rechazo de la función del check ban_has_reason, que
-- también saltaría más abajo y haría pasar la aserción por el motivo equivocado.
select throws_ok(
  $$select private.moderation_ban('00000000-0000-0000-0000-0000004010e5', '')$$,
  'P0001', 'La sanción necesita un motivo: es lo que se le muestra al usuario.',
  'sancionar sin motivo falla'
);

select throws_ok(
  $$select private.moderation_ban('00000000-0000-0000-0000-0000004010e5', '   ')$$,
  'P0001', 'La sanción necesita un motivo: es lo que se le muestra al usuario.',
  'un motivo de solo espacios tampoco vale'
);

select results_eq(
  $$select p.banned_at is null, r.state::text, rp.status::text
    from public.profiles p, public.reviews r, public.review_reports rp
    where p.id = '00000000-0000-0000-0000-000000401001'
      and r.id = '00000000-0000-0000-0000-0000004010f1'
      and rp.id = '00000000-0000-0000-0000-0000004010e5'$$,
  $$values (true, 'active', 'pending')$$,
  'y el intento fallido no sanciona a nadie ni toca la reseña'
);

select private.moderation_ban(
  '00000000-0000-0000-0000-0000004010e4', '  Insultos reiterados a un docente.  ');

select results_eq(
  $$select banned_at is not null, ban_reason from public.profiles
    where id = '00000000-0000-0000-0000-000000401004'$$,
  $$values (true, 'Insultos reiterados a un docente.')$$,
  'sancionar sella banned_at y guarda el motivo sin espacios'
);

select results_eq(
  $$select id, state::text from public.reviews
    where author_id = '00000000-0000-0000-0000-000000401004' order by id$$,
  $$values ('00000000-0000-0000-0000-0000004010f4'::uuid, 'removed_by_moderation'),
          ('00000000-0000-0000-0000-0000004010f5'::uuid, 'removed_by_moderation')$$,
  'y elimina todas las reseñas del autor, incluida la de otro par que nadie reportó (FR-056)'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000401004","role":"authenticated"}';

-- Con las cifras exactas: un isnt_empty pasaría igual si el sancionado viera
-- solo parte de los resúmenes.
select results_eq(
  $$select average_rating, rating_count from public.teacher_course_summaries
    where course_teacher_id = '00000000-0000-0000-0000-0000004010c1'$$,
  $$values (3.5::numeric, 2::bigint)$$,
  'el sancionado conserva la lectura de los resúmenes (FR-050)'
);

select results_eq(
  $$select id, banned_at is not null, ban_reason from public.profiles$$,
  $$values ('00000000-0000-0000-0000-000000401004'::uuid, true,
            'Insultos reiterados a un docente.')$$,
  'y su motivo, que es lo único que la interfaz le puede mostrar (FR-057)'
);

reset role;

-- ---------------------------------------------------------------------------
-- deactivate_account
-- ---------------------------------------------------------------------------
select private.deactivate_account('00000000-0000-0000-0000-000000401005');

select results_eq(
  $$select id, state::text, purge_after is not null from public.reviews
    where author_id = '00000000-0000-0000-0000-000000401005' order by id$$,
  $$values ('00000000-0000-0000-0000-0000004010f6'::uuid, 'deleted_by_author', true),
          ('00000000-0000-0000-0000-0000004010f7'::uuid, 'deleted_by_author', true)$$,
  'la baja elimina todas las reseñas del usuario y les sella purge_after'
);

select results_eq(
  $$select career_id is null, term is null, deactivated_at is not null
    from public.profiles where id = '00000000-0000-0000-0000-000000401005'$$,
  $$values (true, true, true)$$,
  'limpia carrera y ciclo y sella deactivated_at'
);

select results_eq(
  $$select banned_until > now() from auth.users
    where id = '00000000-0000-0000-0000-000000401005'$$,
  $$values (true)$$,
  'y bloquea el login por auth.users.banned_until'
);

select results_eq(
  $$select (select count(*) from auth.users where id = '00000000-0000-0000-0000-000000401005')::int,
           (select count(*) from public.profiles where id = '00000000-0000-0000-0000-000000401005')::int$$,
  $$values (1, 1)$$,
  'la baja es funcional: no borra ni la cuenta ni el perfil'
);

-- Pedir la baja no es una salida de la expulsión.
select private.deactivate_account('00000000-0000-0000-0000-000000401006');

select results_eq(
  $$select banned_at is not null, ban_reason, deactivated_at is not null
    from public.profiles where id = '00000000-0000-0000-0000-000000401006'$$,
  $$values (true, 'Reincidencia tras una sanción.', true)$$,
  'la sanción sobrevive a la baja'
);

-- ---------------------------------------------------------------------------
-- purge_expired_reviews
-- ---------------------------------------------------------------------------
-- Los vencimientos se ponen a mano y no se heredan del trigger: si el testigo
-- que "aún no vence" llegara con purge_after nulo, sobreviviría a cualquier
-- purga y la aserción de abajo no probaría nada.
update public.reviews set purge_after = now() - interval '1 day'
where id = '00000000-0000-0000-0000-0000004010f6';

update public.reviews set purge_after = now() - interval '2 days'
where id = '00000000-0000-0000-0000-0000004010f2';

update public.reviews set purge_after = now() + interval '29 days'
where id = '00000000-0000-0000-0000-0000004010f7';

-- La purga barre la tabla entera, así que el número que devuelve solo es
-- afirmable si nada de fuera de TEST401 puede vencer (la transacción revierte).
update public.reviews set purge_after = null
where purge_after is not null
  and course_teacher_id not in (
    select id from public.course_teachers where course_code = 'TEST401');

select is(
  (select private.purge_expired_reviews()),
  2,
  'la purga devuelve cuántas filas borró'
);

select is_empty(
  $$select id from public.reviews
    where id in ('00000000-0000-0000-0000-0000004010f2',
                 '00000000-0000-0000-0000-0000004010f6')$$,
  'las reseñas vencidas desaparecen físicamente'
);

select results_eq(
  $$select r.id from public.reviews r
    join public.course_teachers ct on ct.id = r.course_teacher_id
    where ct.course_code = 'TEST401' order by r.id$$,
  $$values ('00000000-0000-0000-0000-0000004010f1'::uuid),
          ('00000000-0000-0000-0000-0000004010f3'::uuid),
          ('00000000-0000-0000-0000-0000004010f4'::uuid),
          ('00000000-0000-0000-0000-0000004010f5'::uuid),
          ('00000000-0000-0000-0000-0000004010f7'::uuid),
          ('00000000-0000-0000-0000-0000004010f8'::uuid)$$,
  'y deja intactas las activas, las sancionadas y la eliminada que aún no vence'
);

select * from finish();
rollback;
