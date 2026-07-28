# Moderación

Runbook de la persona que revisa reportes. No hay consola de administración (FR-051): todo se
hace desde el **SQL Editor de Supabase Studio**, que corre como `postgres`, dueño de las funciones
del esquema `private`. Ningún rol de la Data API (`anon`, `authenticated`) puede invocarlas, así
que estas operaciones no son alcanzables desde la aplicación.

Reemplaza `<report_id>`, `<user_id>` y los correos por los valores reales. Todas las consultas de
abajo están verificadas contra la base.

---

## 1. Bandeja: reportes pendientes

Lo que hace falta para decidir, y nada más:

```sql
select
  rp.id                                       as report_id,
  date_trunc('minute', now() - rp.created_at) as antiguedad,
  rp.reason,
  rp.details,
  ct.course_code,
  ct.teacher_name,
  r.rating,
  r.comment,
  (select count(*) from public.review_reports o
     where o.review_id = rp.review_id and o.status = 'pending') as reportes_pendientes,
  (select count(*) from public.reviews o
     where o.author_id = r.author_id and o.state = 'active')    as activas_del_autor
from public.review_reports rp
join public.reviews r          on r.id  = rp.review_id
join public.course_teachers ct on ct.id = r.course_teacher_id
where rp.status = 'pending'
order by rp.created_at;
```

- `details` solo trae texto cuando `reason = 'other'`; en los demás motivos está vacío y es normal.
- `reportes_pendientes` dice cuánta gente reportó la misma reseña. Un `1` es un reporte aislado.
- **No se muestra quién escribió la reseña ni quién la reportó.** La decisión se toma sobre el
  texto y el motivo, no sobre la persona. `activas_del_autor` es la única señal que viene del
  autor y es un conteo anónimo: existe porque `moderation_ban` borra todas sus reseñas y hay que
  saber cuántas se van a perder antes de firmarlo. Si en algún caso hiciera falta la identidad, se
  saca aparte con el `report_id` a la vista; no forma parte de la bandeja.

Las puntuaciones sin comentario no llegan acá: los estudiantes no las pueden reportar (FR-052). Si
una resulta abusiva, se le aplican las mismas decisiones a mano.

---

## 2. Las tres decisiones (FR-047)

Cada reporte termina en exactamente una. Las tres exigen que el reporte siga en `pending`; si ya
fue resuelto, la función corta con `No hay un reporte pendiente con ese id.` y no toca nada.

### Mantener la reseña

```sql
select private.moderation_keep('<report_id>');
```

Marca el reporte como `kept`. La reseña no cambia y vuelve a ser visible para quien la reportó.

### Eliminar la reseña

```sql
select private.moderation_remove('<report_id>');
```

Pasa la reseña a `removed_by_moderation` y cierra como `removed` **todos** los reportes pendientes
de esa reseña, no solo el que estás revisando. El autor conserva su cuenta. La reseña deja de
contar en promedios y porcentajes de inmediato, y se borra de verdad a los 30 días (sección 6).

### Eliminar y banear al autor

```sql
select private.moderation_ban('<report_id>', 'Motivo de la sanción.');
```

Dos advertencias, en este orden:

1. **Borra TODAS las reseñas activas del autor, no solo la reportada.** Revisa
   `activas_del_autor` en la bandeja antes de ejecutarlo. Es irreversible desde acá.
2. **El motivo se le muestra al sancionado** cada vez que intente leer comentarios, publicar,
   editar o reportar (FR-057). Escríbelo pensando en que lo va a leer: concreto, en segunda
   persona, sin jerga interna y sin citar al reportante. Un motivo vacío o de solo espacios es
   rechazado (`La sanción necesita un motivo: es lo que se le muestra al usuario.`).

El baneo no cierra la sesión en Auth a propósito: el sancionado tiene que poder entrar para leer
por qué. Lo que se le cierra es todo lo demás.

### Comprobar el resultado

```sql
select id, status, resolved_at from public.review_reports where id = '<report_id>';
```

Y para ver las sanciones vigentes:

```sql
select id, banned_at, ban_reason from public.profiles where banned_at is not null;
```

---

## 3. Baja de cuenta a pedido

El estudiante pide dar de baja su cuenta. Primero se busca su `user_id` por correo:

```sql
select id, email from auth.users where email = 'alguien@utec.edu.pe';
```

Y luego:

```sql
select private.deactivate_account('<user_id>');
```

**Qué limpia**: bloquea el acceso en Auth (`banned_until = infinity`), pasa todas sus reseñas
activas a `deleted_by_author` — dejan de verse y de contar al instante, y se borran de verdad a los
30 días — y vacía la carrera y el ciclo del perfil.

**Qué conserva**: la fila del perfil, con `deactivated_at` sellado. Si esa cuenta tenía una sanción,
`banned_at` y `ban_reason` sobreviven intactos: una baja a pedido no es una vía para limpiar el
historial y volver a entrar.

Comprobación:

```sql
select id, deactivated_at, career_id, term from public.profiles where deactivated_at is not null;
```

---

## 4. Arranque en frío (SC-009)

Cuántos pares docente–curso tienen al menos una puntuación y cuántos estudiantes distintos han
contribuido:

```sql
select
  count(distinct course_teacher_id) as pares_con_puntuacion,
  count(distinct author_id)         as estudiantes_que_contribuyeron,
  count(*)                          as puntuaciones_activas
from public.reviews
where state = 'active';
```

Se compara contra el total de pares reseñables (`select count(*) from public.course_teachers where
is_current;`) para saber qué proporción del catálogo ya tiene señal. Cuenta pares aunque hayan
dejado de estar vigentes; para la cobertura de la oferta actual, agrega el filtro por
`course_teachers.is_current`.

---

## 5. ¿Sigue aportando la recomendación? (FR-061)

```sql
select corr(rating, recommends::int::float8), count(*) from public.reviews where state = 'active';
```

Si la correlación se acerca a 1 con un `count` ya representativo, la pregunta de recomendación es
redundante con las estrellas y retirarla es la decisión esperada; por debajo de ~0.85 aporta señal
propia y se queda. Con pocas decenas de reseñas el número no significa nada: no se decide hasta
tener volumen.

---

## 6. Purga

`private.purge_expired_reviews()` borra físicamente las reseñas cuyo `purge_after` ya venció —los
30 días desde que se eliminaron, por moderación o por su autor— y devuelve cuántas filas borró. No
toca sanciones: esas viven en `profiles` y no expiran.

Corre sola todos los días a las 04:17 UTC por `pg_cron`. Para comprobar que el job existe:

```sql
select * from cron.job;
```

Debe aparecer `purgar-resenas-eliminadas`, con `schedule` `17 4 * * *`, `command`
`select private.purge_expired_reviews();` y `active = t`. Si no está, la purga no está corriendo y
hay que reprogramarla.

Para ver el atraso pendiente sin ejecutar nada:

```sql
select count(*) from public.reviews where purge_after is not null and purge_after < now();
```

En condiciones normales ese número es 0 o casi. Solo se invoca la función a mano si el job estuvo
caído.
