# UTEC Horarios

Aplicación web para planificar y armar tu horario de clases en UTEC (Universidad de Tecnología e Ingeniería). Visualiza los cursos disponibles en un calendario semanal, detecta cruces de horario automáticamente y guarda tu selección en el navegador.

## Características

- **Búsqueda de cursos** por código o nombre
- **Calendario semanal** interactivo con bloques de horario por curso
- **Detección de conflictos** automática al agregar cursos o cambiar secciones
- **Previsualización** de secciones antes de seleccionarlas
- **Subsesiones** — selección independiente de laboratorios, teorías, etc.
- **Carga Hábil** — sube tu PDF de carga hábil para filtrar solo los cursos que puedes llevar
- **Persistencia** en localStorage (tu horario se guarda entre sesiones)
- **Modo oscuro/claro**
- **431 cursos**, 744 secciones y 1806 sesiones (período 2026-1)

## Tech Stack

- **Next.js 16** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS 4**

## Inicio rápido

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## Estructura del proyecto

```
src/
├── app/
│   ├── page.tsx              # Página principal con estado global
│   └── api/parse-pdf/        # API para procesar PDF de Carga Hábil
├── components/
│   ├── CourseSearch.tsx       # Buscador de cursos
│   ├── SectionSelector.tsx   # Selector de secciones y subsesiones
│   ├── WeeklyCalendar.tsx    # Calendario semanal
│   ├── CalendarBlock.tsx     # Bloque individual en el calendario
│   ├── SelectedCoursesList.tsx # Lista de cursos seleccionados
│   ├── ThemeToggle.tsx       # Toggle modo oscuro/claro
│   └── ToastAlert.tsx        # Notificaciones toast
├── lib/
│   ├── schedule-utils.ts     # Colores, conflictos, búsqueda, constantes
│   ├── subsession-utils.ts   # Análisis de subsesiones (labs, teorías)
│   └── storage.ts            # Helpers de localStorage
├── data/
│   └── courses.json          # Datos de cursos extraídos del PDF
└── types/
    └── index.ts              # Tipos: Course, Section, Session, etc.

scripts/
└── parse-pdf.js              # Parser del PDF de horarios (pdfjs-dist)
```

## Actualización de datos

Los datos de cursos se extraen del PDF oficial de horarios de UTEC usando el script de parsing:

```bash
node scripts/parse-pdf.js
```

El script usa `pdfjs-dist` con extracción basada en posición (no texto) para manejar campos concatenados en el PDF. Genera `src/data/courses.json`.

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run lint` | Linter (ESLint) |
