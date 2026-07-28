-- Un grant de más no rompe ninguna otra prueba ni se nota en la interfaz: la
-- fuga solo se ve en el catálogo. Este archivo mira ahí y nada más.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions, public;

select plan(21);

-- ---------------------------------------------------------------------------
-- superficie del esquema private
-- ---------------------------------------------------------------------------
select set_eq(
  $$select p.proname::text from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'$$,
  array['is_banned', 'moderation_keep', 'moderation_remove', 'moderation_ban',
        'deactivate_account', 'purge_expired_reviews'],
  'private contiene exactamente las seis funciones previstas'
);

-- El cross join enumera quién incumple; la lista vacía es la única salida sana.
select is_empty(
  $$select f, r
    from unnest(array['private.moderation_keep(uuid)',
                      'private.moderation_remove(uuid)',
                      'private.moderation_ban(uuid, text)',
                      'private.deactivate_account(uuid)',
                      'private.purge_expired_reviews()']) f,
         unnest(array['anon', 'authenticated', 'public']) r
    where has_function_privilege(r, f, 'execute')$$,
  'ni moderación ni purga son ejecutables por anon, authenticated ni PUBLIC (FR-047, FR-051)'
);

select ok(
  has_function_privilege('authenticated', 'private.is_banned()', 'execute'),
  'authenticated sí ejecuta is_banned: las políticas la llaman en su nombre (FR-049)'
);

select ok(
  not has_function_privilege('anon', 'private.is_banned()', 'execute')
  and not has_function_privilege('public', 'private.is_banned()', 'execute'),
  'is_banned no es ejecutable por anon ni por PUBLIC'
);

select ok(
  not has_schema_privilege('anon', 'private', 'usage'),
  'anon no tiene usage sobre private'
);

select ok(
  has_schema_privilege('authenticated', 'private', 'usage'),
  'authenticated sí: sin usage, is_banned falla y con ella toda política que la invoca'
);

-- ---------------------------------------------------------------------------
-- search_path de las security definer
-- ---------------------------------------------------------------------------
-- Sin este guardián, la aserción siguiente pasaría también si no quedara
-- ninguna función security definer que revisar.
select isnt_empty(
  $$select p.proname::text from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosecdef$$,
  'hay funciones security definer que revisar en public y private'
);

select is_empty(
  $$select n.nspname || '.' || p.proname from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosecdef
      and coalesce(array_to_string(p.proconfig, ','), '') !~ 'search_path='$$,
  'ninguna security definer se queda sin search_path fijado (sería escalable por search_path)'
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
select tables_are(
  'public',
  array['careers', 'course_teachers', 'profiles', 'reviews', 'review_reports'],
  'public tiene exactamente las cinco tablas del diseño'
);

select is_empty(
  $$select c.relname::text from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity$$,
  'ninguna tabla de public se queda sin RLS habilitada (R2)'
);

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------
-- Solo los cuatro verbos DML: TRUNCATE, REFERENCES, TRIGGER y MAINTAIN los
-- concede Supabase por default privileges a todo lo que se crea en public.
--
-- has_table_privilege ignora los grants de columna, así que `grant select
-- (comment) on reviews to anon` le pasaría por debajo: los tres verbos que
-- admiten grant por columna se miran con has_any_column_privilege.
select is_empty(
  $$select t, v
    from unnest(array['public.reviews', 'public.review_reports', 'public.profiles']) t,
         unnest(array['select', 'insert', 'update']) v
    where has_any_column_privilege('anon', t, v)
    union all
    select t, 'delete'
    from unnest(array['public.reviews', 'public.review_reports', 'public.profiles']) t
    where has_table_privilege('anon', t, 'delete')$$,
  'anon no tiene ningún verbo DML sobre reviews, review_reports ni profiles, ni por columna'
);

-- Cierra la vía indirecta: una vista nueva sobre reviews concedida a anon
-- aparece acá aunque los grants de la tabla estén bien.
select set_eq(
  $$select c.relname::text from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p', 'f')
      and has_any_column_privilege('anon', c.oid, 'select')$$,
  array['careers', 'course_teachers', 'teacher_course_summaries'],
  'lo único legible sin sesión son los dos catálogos y la vista de resúmenes'
);

-- Tercera vía a reviews: en public toda función es RPC de la Data API, y
-- Postgres concede execute a PUBLIC por defecto. Una security definer salta
-- RLS. Las de trigger quedan fuera: solo se invocan desde un trigger.
select is_empty(
  $$select n.nspname || '.' || p.proname from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and p.prorettype <> 'pg_catalog.trigger'::regtype
      and (has_function_privilege('anon', p.oid, 'execute')
        or has_function_privilege('public', p.oid, 'execute'))$$,
  'ninguna security definer de public es invocable por anon como RPC (R2)'
);

-- ---------------------------------------------------------------------------
-- authenticated
-- ---------------------------------------------------------------------------
select ok(
  not has_table_privilege('authenticated', 'public.reviews', 'delete'),
  'eliminar es un update de state; un grant de delete saltaría la retención de 30 días (FR-039, FR-040)'
);

select is_empty(
  $$select c.relname::text from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and has_table_privilege('authenticated', c.oid, 'delete')$$,
  'authenticated no borra filas en ninguna tabla de public'
);

-- Las tres aserciones siguientes cierran la evasión de FR-030 medida contra el
-- esquema: con update de TABLA sobre reviews, el autor antedata published_at en
-- sus 8 reseñas y publica la novena; con insert de tabla, 20 filas antedatadas
-- en un statement no tocan ninguna ventana. RLS no puede verlo — no mira la fila
-- vieja —, así que lo único que lo sostiene es el privilegio por columna.
select is_empty(
  $$select c from unnest(array['id', 'author_id', 'course_teacher_id',
                               'declared_attendance', 'published_at',
                               'comment_published_at', 'comment_edited_at',
                               'purge_after', 'updated_at']) c
    where has_column_privilege('authenticated', 'public.reviews', c, 'update')$$,
  'authenticated no actualiza ninguna columna sellada de reviews (FR-030, FR-055, retención)'
);

select is_empty(
  $$select c from unnest(array['id', 'state', 'published_at',
                               'comment_published_at', 'comment_edited_at',
                               'purge_after', 'updated_at']) c
    where has_column_privilege('authenticated', 'public.reviews', c, 'insert')$$,
  'ni las fija al publicar: published_at sale del default, no del cliente (FR-030, FR-033)'
);

-- Contrapeso: sin esto, la aserción anterior se "arreglaría" revocando de más y
-- dejando al autor sin poder editar ni eliminar su reseña.
select is_empty(
  $$select c from unnest(array['rating', 'recommends', 'comment',
                               'respect_acknowledged']) c
    where not has_column_privilege('authenticated', 'public.reviews', c, 'update')$$,
  'y sí edita puntuación, recomendación y comentario (FR-037, FR-025)'
);

-- `state` fuera del grant: eliminar pasa por delete_own_review, que comprueba la
-- propiedad. Con el grant, el autor podría además resucitar lo que moderación
-- eliminó (FR-048).
select ok(
  not has_column_privilege('authenticated', 'public.reviews', 'state', 'update')
  and has_function_privilege('authenticated', 'public.delete_own_review(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.delete_own_review(uuid)', 'execute')
  and not has_function_privilege('public', 'public.delete_own_review(uuid)', 'execute'),
  'eliminar es delete_own_review y solo con sesión; state no se toca a mano (FR-039, FR-048)'
);

-- ---------------------------------------------------------------------------
-- vistas
-- ---------------------------------------------------------------------------
select ok(
  has_table_privilege('anon', 'public.teacher_course_summaries', 'select')
  and has_table_privilege('authenticated', 'public.teacher_course_summaries', 'select'),
  'los resúmenes se leen con y sin sesión (FR-008)'
);

select ok(
  not has_table_privilege('anon', 'public.review_comments', 'select')
  and has_table_privilege('authenticated', 'public.review_comments', 'select'),
  'los comentarios exigen sesión, y lo corta el grant (FR-013)'
);

select * from finish();
rollback;
