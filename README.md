# UTEC Horarios

Aplicación web para planificar y armar tu horario de clases en UTEC (Universidad de Tecnología e Ingeniería). Visualiza los cursos disponibles en un calendario semanal, detecta cruces de horario automáticamente y guarda tu selección en el navegador.

## Características

- **Búsqueda de cursos** por código o nombre
- **Calendario semanal** interactivo con bloques de horario por curso
- **Detección de conflictos** automática al agregar cursos o cambiar secciones, con opción de **permitir cruces** (los bloques solapados se renderizan lado a lado)
- **Previsualización** de secciones antes de seleccionarlas
- **Subsesiones** — selección independiente de laboratorios, teorías, etc.
- **Carga Hábil** — sube tu PDF de carga hábil para filtrar solo los cursos que puedes llevar
- **Exportar horario** como imagen PNG (al portapapeles o descarga)
- **Persistencia** en localStorage (tu horario se guarda entre sesiones)
- **Modo oscuro/claro**
- **445 cursos**, 777 secciones y 1821 sesiones (período 2026-2)

## Tech Stack

- **Next.js 16** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS 4**
- **pdfjs-dist** — extracción de datos de los PDFs
- **html-to-image** — exportar el calendario como PNG
- **Supabase** — autenticación con Google restringida a cuentas `@utec.edu.pe`
- **Vercel Analytics**

## Inicio rápido

Requisitos: **Node >= 20.9** y **pnpm** (el proyecto fija la versión con el campo `packageManager`; si usás Corepack, `corepack enable` la instala sola).

```bash
# Instalar dependencias
pnpm install

# Iniciar servidor de desarrollo
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

El login es opcional: sin variables de entorno la app corre igual, solo queda deshabilitado el inicio de sesión.

## Autenticación (opcional)

La app permite iniciar sesión con Google, restringido a cuentas `@utec.edu.pe`. Copia `.env.example` a `.env.local` y rellena las dos variables:

| Variable | Dónde sacarla |
|----------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys |

Ambas son públicas por diseño: viajan al navegador.

Hay una tercera opcional, `NEXT_PUBLIC_SITE_URL`, con el origen público que se usa para armar las URLs de redirección del login. En Vercel se deduce del deploy y en local del propio request, así que solo hace falta si la app corre detrás de otro proxy o con un dominio propio.

Para montar el proyecto desde cero:

1. **Google Cloud Console** → *APIs & Services → Credentials → OAuth client ID → Web application*. En *Authorized redirect URIs* va la URL de Supabase, no la de la app: `https://<ref>.supabase.co/auth/v1/callback`. Scopes: solo `openid`, `email` y `profile`.
2. **Supabase → Authentication → Sign In / Providers → Google**: pegar Client ID y Client Secret.
3. **Supabase → Authentication → URL Configuration**: *Site URL* la de producción, y en *Redirect URLs* `http://localhost:3000/**` más el patrón de previews.
4. **Supabase → Authentication → Hooks → Before User Created**: apuntar a `public.hook_restrict_signup_to_utec`, la función que crea `supabase/migrations/`. Rechaza en el servidor cualquier alta fuera del dominio.

El dominio lo imponen el hook, que bloquea el alta, y el callback, que vuelve a comprobar el correo antes de dejar pasar la sesión. El parámetro `hd` que se le pasa a Google no es una restricción: solo le sugiere qué cuenta ofrecer.

Rutas del flujo: `GET /auth/login` lleva a Google, `GET /auth/callback` cierra el intercambio y deja la sesión en cookies, `POST /auth/signout` la cierra.

El porqué de cada decisión —las tres capas, los scopes de Google, por qué el login es opcional— está en [`docs/auth.md`](docs/auth.md).

## Supabase en local

Para tocar el esquema no hace falta el proyecto de la nube: la CLI levanta un Postgres con Auth al lado, con las migraciones ya aplicadas.

Requisitos: **Docker** corriendo y la [CLI de Supabase](https://supabase.com/docs/guides/local-development) (`brew install supabase/tap/supabase`).

```bash
supabase start      # levanta el stack
supabase db reset   # recrea la base: aplica migrations/ y vuelve a correr seed.sql
supabase stop       # apaga todo
```

Ojo con la diferencia: `supabase start` aplica migraciones y seed **solo la primera vez**. Después el estado vive en un volumen de Docker y sobrevive a `stop`/`start`, así que tras agregar una migración o tocar el seed lo que hace falta es `supabase db reset`.

`supabase start` imprime las URLs del stack. Las dos que vas a usar:

| | |
|---|---|
| **Studio** (explorar la base) | http://127.0.0.1:54323 |
| **Mailpit** (los correos que "envía" Auth) | http://127.0.0.1:54324 |

**El login con Google no está configurado en local**, por decisión, no por una limitación de Supabase: se podría habilitar con un bloque `[auth.external.google]` en `config.toml` y un client ID propio, pero eso pide credenciales de OAuth por cada quien desarrolla. Tal como está, local sirve para el esquema, las migraciones y los datos; para probar el flujo de login apunta el `.env.local` al proyecto remoto, como dice [Autenticación](#autenticación-opcional).

El hook `before_user_created` sí está activo en local, enganchado desde `config.toml`. Es a propósito: si local aceptara cualquier dominio, el rechazo de las cuentas que no son de UTEC solo se descubriría en producción.

### Cuentas de prueba

`seed.sql` deja dos estudiantes ya confirmados, con contraseña, para tener filas de `auth.users` con las que trabajar sin pasar por Google:

| Correo | Contraseña |
|---|---|
| `estudiante@utec.edu.pe` | `horarios123` |
| `companera@utec.edu.pe` | `horarios123` |

Son para consultas y pruebas desde la API o Studio, no para el botón de login, que es solo Google.

Estas contraseñas son públicas: están en el repo. `supabase db push` sube solo migraciones, pero **`supabase db push --include-seed` sí ejecuta el seed contra la base remota** — no uses ese flag apuntando a producción o crearás estas cuentas allá.

### Migraciones

El esquema vive en `supabase/migrations/`, en archivos `<timestamp>_<slug>.sql` que se aplican en orden. Para una tabla o función nueva:

```bash
supabase migration new nombre_del_cambio   # crea el archivo vacío
# … escribes el SQL …
supabase db reset                          # lo aplica desde cero y valida que corre
```

El cambio viaja al PR como archivo. **No edites una migración ya mergeada**: en producción ya se aplicó y no se vuelve a correr, así que un arreglo va en una migración nueva.

Para empujar a la nube: `supabase link --project-ref <ref>` y después `supabase db push`. Requiere estar logueado (`supabase login`) con una cuenta que tenga acceso al proyecto. Si `supabase projects list` no lo muestra, o estás en otra cuenta o esa cuenta no es miembro de la organización dueña del proyecto; en cualquiera de los dos casos el link falla.

## Estructura del proyecto

```
src/
├── app/
│   ├── layout.tsx              # Layout raíz, metadata y Analytics
│   ├── page.tsx                # Página principal con estado global
│   ├── globals.css             # Estilos globales (Tailwind)
│   ├── api/parse-pdf/          # API para procesar PDF de Carga Hábil
│   └── auth/
│       ├── login/              # Arranca el OAuth con Google
│       ├── callback/           # Canjea el code y valida el dominio
│       ├── signout/            # Cierra la sesión
│       └── error/              # Página de error de login
├── components/
│   ├── CourseSearch.tsx        # Buscador de cursos
│   ├── SectionSelector.tsx     # Selector de secciones y subsesiones
│   ├── WeeklyCalendar.tsx      # Calendario semanal
│   ├── CalendarBlock.tsx       # Bloque individual en el calendario
│   ├── SelectedCoursesList.tsx # Lista de cursos seleccionados
│   ├── ThemeToggle.tsx         # Toggle modo oscuro/claro
│   ├── ToastAlert.tsx          # Notificaciones toast
│   └── FeedbackButton.tsx      # Botón flotante al grupo de ayuda
├── lib/
│   ├── schedule-utils.ts       # Colores, conflictos, búsqueda, constantes
│   ├── subsession-utils.ts     # Análisis de subsesiones (labs, teorías)
│   ├── storage.ts              # Helpers de localStorage
│   ├── auth-domain.ts          # Allowlist del dominio de correo
│   ├── rate-limit.ts           # Contador por IP del rate limit
│   ├── request-origin.ts       # Origen público del request (x-forwarded-*)
│   └── supabase/
│       ├── client.ts           # Cliente de navegador
│       ├── server.ts           # Cliente de servidor (cookies)
│       └── proxy.ts            # Refresco de sesión en el proxy
├── data/
│   └── courses.json            # Datos de cursos extraídos del PDF
├── types/
│   └── index.ts                # Tipos: Course, Section, Session, etc.
└── proxy.ts                    # Rate limiting en /api + refresco de sesión

supabase/
├── config.toml                 # Config del stack local (puertos, auth, hooks)
├── migrations/                 # Esquema y hooks de la base de datos
├── seed.sql                    # Datos de desarrollo (solo local)
└── functions/send-email/       # Edge Function: correos de Auth vía Resend

scripts/
└── parse-pdf.js                # Parser del PDF de horarios (pdfjs-dist)

docs/
└── auth.md                     # Decisiones de autenticación y su porqué
```

## Actualización de datos

Los datos de cursos se extraen del PDF oficial de horarios de UTEC (`consulta_horario.pdf`, en la raíz del repo) usando el script de parsing:

```bash
pnpm parse-pdf
```

El script usa `pdfjs-dist` con extracción basada en posición (no texto) para manejar campos concatenados en el PDF. Genera `src/data/courses.json`.

Para cambiar de ciclo: reemplaza `consulta_horario.pdf`, corre el script y actualiza el período en `src/app/layout.tsx` (título) y `src/app/page.tsx` (header).

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Build de producción |
| `pnpm start` | Servidor de producción |
| `pnpm lint` | Linter (ESLint) |
| `pnpm test` | Tests (Vitest) |
| `pnpm test:watch` | Tests en modo watch |
| `pnpm parse-pdf` | Regenera `courses.json` desde el PDF de horarios |

## Tests

```bash
pnpm test
```

- **`tests/courses-data.test.ts`** — invariantes sobre `courses.json`: días válidos, horarios `HH:MM` con fin posterior al inicio, sesiones dentro de la grilla 07:00-22:00, códigos únicos y bien formados, `enrolled <= capacity`. Es la red de seguridad del update de ciclo: si el parseo del PDF sale mal, falla acá y no en producción.
- **`tests/parse-pdf.test.ts`** — golden test: parsea el PDF y lo compara contra el `courses.json` commiteado. Detecta tanto un PDF cambiado sin regenerar como un cambio de comportamiento de `pdfjs-dist`.
- **`tests/storage.test.ts`** — el store de `localStorage`, incluyendo la estabilidad referencial de `getSnapshot` (si se rompe, `useSyncExternalStore` entra en loop infinito), datos corruptos y fallos de escritura.
- **`tests/auth-domain.test.ts`** — la allowlist del dominio de correo, con los casos que un `endsWith` dejaría pasar (`@notutec.edu.pe`, `@utec.edu.pe.evil.com`).
- **`tests/rate-limit.test.ts`** y **`tests/proxy.test.ts`** — el contador por IP, el 429 de `/api` y el matcher del proxy (si deja de excluir estáticos, el proxy corre en cada asset sin que falle nada más).

Después de correr `pnpm parse-pdf` para un ciclo nuevo, `pnpm test` valida los datos generados antes de deployar.

Las migraciones y el seed no se prueban con Vitest: los valida el job `supabase` del CI, que levanta el stack local y comprueba que un estudiante sembrado inicia sesión y que el hook de dominio rechaza cuentas ajenas. Cubre las dos cosas que se rompen en silencio: una migración que ya no aplica sobre una base limpia, y un seed que inserta datos que Auth después no puede leer.

## Cómo contribuir

Este proyecto trabaja **guiado por spec**: las features se definen antes de implementarse. Abres un issue con la propuesta, se discute, y el PR de implementación incluye el spec acordado en `specs/NNN-slug/spec.md`.

Los bugfixes, refactors y actualizaciones de datos del ciclo no necesitan spec — van directo a PR.

Todos los detalles en [CONTRIBUTING.md](CONTRIBUTING.md).

## Notas de dependencias

- `pnpm-workspace.yaml` declara en `allowBuilds` los únicos paquetes autorizados a correr scripts de instalación (`sharp`, `unrs-resolver`). pnpm bloquea el resto por defecto como medida de seguridad.
- `@vercel/analytics` debe quedarse en **>= 2.0.1**. La 2.0.0 declaraba `nuxt` como peer *requerido* (faltaba en `peerDependenciesMeta`), lo que arrastraba Nuxt, Vite y Nitro enteros al árbol de dependencias.
