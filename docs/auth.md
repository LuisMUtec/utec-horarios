# Decisiones de autenticación

El cómo montarlo está en el [README](../README.md). Acá solo el porqué.

## Alcance

- **Login opcional.** La app funciona sin sesión; no hay gate ni redirección forzada.
- **Sin variables de entorno la app corre igual.** El job `build` del CI no tiene secretos.
- Sin UI, sin tabla `profiles`, sin RLS, sin sincronizar horarios. Eso viene después.

## Decisiones

| Decisión | Por qué |
|---|---|
| Google como único proveedor, sin OTP ni contraseñas | UTEC usa Google Workspace (`dig MX utec.edu.pe` → `aspmx.l.google.com`): el login con Google ya prueba la titularidad del correo. |
| Scopes solo `openid`, `email`, `profile` | Cualquier scope sensible manda la app a revisión de Google. |
| El dominio lo imponen el hook y el callback | `hd` no cuenta: solo le sugiere a Google qué cuenta ofrecer y se quita desde el navegador. El hook bloquea el alta y el callback cubre a quien ya existía. |
| El SQL del hook no sale de la doc de Supabase | Su ejemplo compara contra `$1` (el `event jsonb` completo, no el dominio) y falla abierto. |
| Allowlist de dominio exacta, no `endsWith` | `endsWith` deja pasar `@notutec.edu.pe`. `@alumno.utec.edu.pe` queda fuera a propósito. |
| La llave de usuario es `sub`, nunca el correo | Google avisa que el correo puede cambiar y no es único. Aplica a la futura tabla `profiles`; el correo solo autoriza. |
| Los campos de perfil (`name`, `picture`, …) necesitan fallback | Google los documenta como *"Might be provided"*, no garantizados. |
| `getClaims()`, no `getSession()` ni `getUser()` | Valida la firma del JWT. `getSession()` en servidor confía en la cookie y es spoofeable. |
| Cliente de Supabase por request, nunca en scope de módulo | Fluid compute reutiliza instancias y filtraría la sesión de un usuario a otro. |
| El `setAll` del proxy aplica las cabeceras anti-caché | Una respuesta que setea cookies de auth no puede quedar en un CDN. |
| El `matcher` del proxy cubre todo menos estáticos | El refresco del token tiene que correr en las páginas: los Server Components no escriben cookies. |
| El callback quita el `code` de la URL | Si no, queda en el historial y en el `Referer`. |
| `/auth/signout` responde 303, no 307 | Para que el navegador siga con `GET` y no repita el `POST`. |
| Publishable key, no la `anon` legacy | Ambas son públicas; la legacy está deprecada y se retira a fines de 2026 (no vence sola: sigue válida hasta deshabilitarla). |
| El origen de los redirects sale de env, no de `x-forwarded-host` | Esa cabecera la fija el cliente: con un host inyectado el `code` de OAuth se puede desviar a otro origen. |

Referencia de los claims: [OpenID Connect de Google](https://developers.google.com/identity/protocols/oauth2/openid-connect).
