#!/usr/bin/env bash
#
# Comprueba los route handlers de reseñas contra el stack real: la app
# levantada, la Supabase local y sus triggers.
#
# Es la costura que ningún otro test cubre. Los tests de vitest simulan el
# `fetch`, así que verifican qué hace la interfaz *dado* un 409; el pgTAP
# verifica las reglas *dentro* de Postgres. Que el handler traduzca de una a
# otra —que publicar dos veces el mismo par termine en 409 y no en un 500— solo
# se ve corriéndolo de verdad.
#
# Uso: supabase start && pnpm dev, y después
#   ./scripts/verificar-api-de-resenas.sh [http://localhost:3000]
#
set -euo pipefail

APP="${1:-http://localhost:3000}"

eval "$(supabase status -o env | sed 's/^/export /')"
REST="$API_URL/rest/v1"

# La contraseña sale del propio seed, como en el job de CI: así este script
# sigue al archivo si alguien la cambia allá.
SEED_PASS=$(sed -n "s/.*extensions\.crypt('\([^']*\)'.*/\1/p" supabase/seed.sql | head -1)
[ -n "$SEED_PASS" ] || { echo "No pude leer la contraseña de supabase/seed.sql"; exit 1; }

ESTUDIANTE='00000000-0000-0000-0000-00000000da01'
fallos=0

# --- utilidades -------------------------------------------------------------

# Lo que escribe @supabase/ssr en la cookie: `base64-` y el JSON de la sesión en
# base64url. El nombre lo deriva supabase-js del host, igual que acá.
cookie_de() {
  local sesion host
  sesion=$(curl -sS -X POST "$API_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$SEED_PASS\"}")

  [ "$(jq -r '.access_token // empty' <<<"$sesion")" ] || {
    echo "El login de $1 no devolvió access_token: $sesion" >&2; exit 1; }

  host=$(sed -E 's#^https?://##; s#[:/].*##' <<<"$API_URL")
  # base64url a mano: `basenc` es de coreutils y no está en macOS, y el `base64`
  # de BSD y el de GNU no comparten la bandera para no partir la salida.
  printf 'sb-%s-auth-token=base64-%s' "${host%%.*}" \
    "$(jq -c . <<<"$sesion" | base64 | tr -d '\n' | tr '+/' '-_' | tr -d '=')"
}

# Ejecuta una petición y devuelve "código<TAB>cuerpo".
pedir() {
  local metodo="$1" ruta="$2" cookie="${3:-}" cuerpo="${4:-}"
  local args=(-sS -o /tmp/resenas-body -w '%{http_code}' -X "$metodo" "$APP$ruta")
  [ -n "$cookie" ] && args+=(-H "Cookie: $cookie")
  [ -n "$cuerpo" ] && args+=(-H 'Content-Type: application/json' -d "$cuerpo")
  # Con salto final: sin él `read` devuelve 1 al llegar a EOF y `set -e` corta
  # el script en la primera comprobación.
  printf '%s\t%s\n' "$(curl "${args[@]}")" "$(cat /tmp/resenas-body)"
}

comprobar() {
  local descripcion="$1" esperado="$2" obtenido="$3" cuerpo="${4:-}"
  if [ "$esperado" = "$obtenido" ]; then
    echo "  ✓ $descripcion"
  else
    echo "  ✗ $descripcion — se esperaba $esperado y llegó $obtenido"
    [ -n "$cuerpo" ] && echo "      $cuerpo"
    fallos=$((fallos + 1))
  fi
}

# El campo tiene que venir en el cuerpo: un 409 sin `own` deja a la interfaz
# sin qué mostrar, y el código es lo que distingue un rechazo de otro.
contiene() {
  local descripcion="$1" filtro="$2" cuerpo="$3"
  if [ "$(jq -r "$filtro // empty" <<<"$cuerpo" 2>/dev/null)" ]; then
    echo "  ✓ $descripcion"
  else
    echo "  ✗ $descripcion — no está en la respuesta: $cuerpo"
    fallos=$((fallos + 1))
  fi
}

# service_role salta RLS, así que prepara y limpia estado sin tocar psql.
limpiar_resenas() {
  curl -sS -X DELETE "$REST/reviews?author_id=eq.$ESTUDIANTE&published_at=gte.$(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '-1 hour' +%Y-%m-%dT%H:%M:%SZ)" \
    -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" >/dev/null
}

par_id() {
  curl -sS "$REST/course_teachers?course_code=eq.$1&teacher_email=eq.$2&select=id" \
    -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" | jq -r '.[0].id // empty'
}

# --- preparación ------------------------------------------------------------

echo "Comprobando $APP contra $API_URL"
limpiar_resenas

COOKIE=$(cookie_de 'estudiante@utec.edu.pe')
COOKIE_BANEADO=$(cookie_de 'sancionado@utec.edu.pe')

# Un par vigente que el estudiante sembrado todavía no reseñó.
PAR=$(curl -sS "$REST/course_teachers?is_current=eq.true&select=course_code,teacher_email&limit=1&order=course_code" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY")
CURSO=$(jq -r '.[0].course_code' <<<"$PAR")
DOCENTE=$(jq -r '.[0].teacher_email' <<<"$PAR")
RESENA="{\"course\":\"$CURSO\",\"teacher\":\"$DOCENTE\",\"declaredAttendance\":true,\"rating\":4,\"recommends\":true}"

echo "Par de prueba: $CURSO / $DOCENTE"

# --- acceso -----------------------------------------------------------------

echo
echo "Acceso"

IFS=$'\t' read -r codigo cuerpo < <(pedir GET "/api/courses/$CURSO/summaries")
comprobar "los resúmenes son públicos (FR-008)" 200 "$codigo" "$cuerpo"

IFS=$'\t' read -r codigo cuerpo < <(pedir GET "/api/reviews?course=$CURSO&teacher=$DOCENTE")
comprobar "leer el par sin sesión corta con 401 (FR-013)" 401 "$codigo" "$cuerpo"

IFS=$'\t' read -r codigo cuerpo < <(pedir POST "/api/reviews" "" "$RESENA")
comprobar "publicar sin sesión corta con 401" 401 "$codigo" "$cuerpo"

IFS=$'\t' read -r codigo cuerpo < <(pedir POST "/api/reviews" "$COOKIE_BANEADO" "$RESENA")
comprobar "una cuenta sancionada recibe 403 (FR-049)" 403 "$codigo" "$cuerpo"
contiene "el 403 trae el motivo (FR-057)" '.reason' "$cuerpo"

# --- validación -------------------------------------------------------------

echo
echo "Validación"

IFS=$'\t' read -r codigo cuerpo < <(pedir POST "/api/reviews" "$COOKIE" \
  "{\"course\":\"$CURSO\",\"teacher\":\"$DOCENTE\",\"declaredAttendance\":true,\"rating\":4}")
comprobar "sin recomendación no publica (FR-061)" 400 "$codigo" "$cuerpo"
contiene "y dice qué falta" '.errors.recommends' "$cuerpo"

IFS=$'\t' read -r codigo cuerpo < <(pedir POST "/api/reviews" "$COOKIE" \
  "{\"course\":\"$CURSO\",\"teacher\":\"$DOCENTE\",\"rating\":4,\"recommends\":true}")
comprobar "sin declarar la experiencia no publica (FR-021)" 400 "$codigo" "$cuerpo"

IFS=$'\t' read -r codigo cuerpo < <(pedir POST "/api/reviews" "$COOKIE" \
  "{\"course\":\"$CURSO\",\"teacher\":\"$DOCENTE\",\"declaredAttendance\":true,\"rating\":9,\"recommends\":true}")
comprobar "una puntuación fuera de escala no publica" 400 "$codigo" "$cuerpo"

# --- publicar ---------------------------------------------------------------

echo
echo "Publicar"

IFS=$'\t' read -r codigo cuerpo < <(pedir POST "/api/reviews" "$COOKIE" "$RESENA")
comprobar "publica con 201 (SC-003: sin perfil ni compromiso)" 201 "$codigo" "$cuerpo"
contiene "y devuelve la reseña" '.review.id' "$cuerpo"

IFS=$'\t' read -r codigo cuerpo < <(pedir POST "/api/reviews" "$COOKIE" "$RESENA")
comprobar "el mismo par otra vez da 409 (FR-027)" 409 "$codigo" "$cuerpo"
contiene "con el código que la interfaz distingue" '.code' "$cuerpo"
contiene "y con la reseña que ya existía" '.own.id' "$cuerpo"

IFS=$'\t' read -r codigo cuerpo < <(pedir GET "/api/reviews?course=$CURSO&teacher=$DOCENTE" "$COOKIE")
comprobar "el par ya devuelve la reseña propia" 200 "$codigo" "$cuerpo"
contiene "con su puntuación" '.own.rating' "$cuerpo"
if [ "$(jq -r '.. | objects | has("author_id") // empty' <<<"$cuerpo" | grep -c true || true)" = "0" ]; then
  echo "  ✓ y sin ningún author_id (SC-006)"
else
  echo "  ✗ la respuesta trae author_id"; fallos=$((fallos + 1))
fi

# --- par fuera de la oferta -------------------------------------------------

echo
echo "Par fuera de la oferta (FR-028)"

OTRO=$(curl -sS "$REST/course_teachers?is_current=eq.true&select=course_code,teacher_email&limit=1&offset=1&order=course_code" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY")
CURSO2=$(jq -r '.[0].course_code' <<<"$OTRO")
DOCENTE2=$(jq -r '.[0].teacher_email' <<<"$OTRO")
ID2=$(par_id "$CURSO2" "$DOCENTE2")

curl -sS -X PATCH "$REST/course_teachers?id=eq.$ID2" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' -d '{"is_current":false}' >/dev/null

IFS=$'\t' read -r codigo cuerpo < <(pedir POST "/api/reviews" "$COOKIE" \
  "{\"course\":\"$CURSO2\",\"teacher\":\"$DOCENTE2\",\"declaredAttendance\":true,\"rating\":4,\"recommends\":true}")
comprobar "publicar sobre un par apagado da 404" 404 "$codigo" "$cuerpo"

IFS=$'\t' read -r codigo cuerpo < <(pedir GET "/api/reviews?course=$CURSO2&teacher=$DOCENTE2" "$COOKIE")
comprobar "y leerlo también" 404 "$codigo" "$cuerpo"

curl -sS -X PATCH "$REST/course_teachers?id=eq.$ID2" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' -d '{"is_current":true}' >/dev/null

# --- límite de 24 horas -----------------------------------------------------

echo
echo "Límite de 24 horas (FR-030, FR-031)"

# Siete de relleno: con la que ya se publicó arriba suman ocho, y la siguiente
# es la que tiene que toparse. El trigger cuenta filas creadas, no activas.
pares=$(curl -sS "$REST/course_teachers?is_current=eq.true&select=id&limit=7&offset=5" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  | jq -c "[.[] | {author_id: \"$ESTUDIANTE\", course_teacher_id: .id, rating: 4, recommends: true, declared_attendance: true}]")

curl -sS -X POST "$REST/reviews" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' -d "$pares" >/dev/null

IFS=$'\t' read -r codigo cuerpo < <(pedir POST "/api/reviews" "$COOKIE" \
  "{\"course\":\"$CURSO2\",\"teacher\":\"$DOCENTE2\",\"declaredAttendance\":true,\"rating\":4,\"recommends\":true}")
comprobar "la novena en 24 h da 429" 429 "$codigo" "$cuerpo"
contiene "con el instante de liberación, ya en ISO" '.releaseAt' "$cuerpo"

# --- cierre -----------------------------------------------------------------

limpiar_resenas

echo
if [ "$fallos" -eq 0 ]; then
  echo "Todo en orden."
else
  echo "$fallos comprobación(es) fallaron."
  exit 1
fi
