-- Toda la lectura pública sale de estas dos vistas. Ninguna expone author_id, y
-- la lista de columnas es la única forma de leer una reseña ajena.
--
-- `get_advisors` las va a marcar como security_definer_view: es deliberado.
-- Activarles security_invoker rompe el acceso anónimo a los resúmenes (FR-008).

-- FR-002, FR-008, FR-060. Vista normal, no materializada: SC-005 prohíbe la
-- ventana de desfase que traería materializarla.
create view public.teacher_course_summaries as
select
  ct.id            as course_teacher_id,
  ct.course_code,
  ct.teacher_email,
  ct.teacher_name,
  round(avg(r.rating)::numeric, 1) as average_rating,
  count(*)                         as rating_count,
  count(r.comment)                 as comment_count,
  -- FR-059. El denominador es count(*) porque la recomendación es obligatoria;
  -- no puede ser cero, un grupo existe solo si tiene al menos una fila.
  round(100.0 * count(*) filter (where r.recommends) / count(*))::int
                                   as recommend_percentage
from public.reviews r
join public.course_teachers ct on ct.id = r.course_teacher_id
where r.state = 'active' and ct.is_current
group by ct.id, ct.course_code, ct.teacher_email, ct.teacher_name;

grant select on public.teacher_course_summaries to anon, authenticated, service_role;

-- FR-035
create view public.review_comments as
select r.id, r.course_teacher_id, ct.course_code, ct.teacher_email,
       r.rating, r.recommends, r.comment,
       r.comment_published_at, r.comment_edited_at
from public.reviews r
join public.course_teachers ct on ct.id = r.course_teacher_id
where r.state = 'active'
  and ct.is_current
  and r.comment is not null                    -- FR-036
  and not private.is_banned()                   -- FR-049
  and not exists (                             -- FR-046
    select 1 from public.review_reports rp
    where rp.review_id = r.id
      and rp.reporter_id = (select auth.uid())
      and rp.status = 'pending'
  );

-- FR-013: la sesión la exige el grant, no un `where`. Sin grant a anon,
-- PostgREST responde 401 antes de evaluar nada.
grant select on public.review_comments to authenticated, service_role;
