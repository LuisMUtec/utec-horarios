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

## Estructura del proyecto

```
src/
├── app/
│   ├── layout.tsx              # Layout raíz, metadata y Analytics
│   ├── page.tsx                # Página principal con estado global
│   ├── globals.css             # Estilos globales (Tailwind)
│   └── api/parse-pdf/          # API para procesar PDF de Carga Hábil
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
│   └── storage.ts              # Helpers de localStorage
├── data/
│   └── courses.json            # Datos de cursos extraídos del PDF
├── types/
│   └── index.ts                # Tipos: Course, Section, Session, etc.
└── middleware.ts               # Rate limiting en las rutas /api

scripts/
└── parse-pdf.js                # Parser del PDF de horarios (pdfjs-dist)
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

Después de correr `pnpm parse-pdf` para un ciclo nuevo, `pnpm test` valida los datos generados antes de deployar.

## Cómo contribuir

Este proyecto trabaja **guiado por spec**: las features se definen antes de implementarse. Abres un issue con la propuesta, se discute, y el PR de implementación incluye el spec acordado en `specs/NNN-slug/spec.md`.

Los bugfixes, refactors y actualizaciones de datos del ciclo no necesitan spec — van directo a PR.

Todos los detalles en [CONTRIBUTING.md](CONTRIBUTING.md).

## Notas de dependencias

- `pnpm-workspace.yaml` declara en `allowBuilds` los únicos paquetes autorizados a correr scripts de instalación (`sharp`, `unrs-resolver`). pnpm bloquea el resto por defecto como medida de seguridad.
- `@vercel/analytics` debe quedarse en **>= 2.0.1**. La 2.0.0 declaraba `nuxt` como peer *requerido* (faltaba en `peerDependenciesMeta`), lo que arrastraba Nuxt, Vite y Nitro enteros al árbol de dependencias.
