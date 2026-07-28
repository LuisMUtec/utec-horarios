# Cómo contribuir

Gracias por querer aportar a UTEC Horarios. Este proyecto lo usan estudiantes reales para armar su horario cada ciclo, así que un cambio mal definido se nota rápido.

Por eso trabajamos **guiados por spec**: antes de escribir código, escribimos qué debe hacer el cambio y lo discutimos. El spec queda versionado en el repo junto al código que lo implementa.

## El flujo en corto

1. **Abre un issue** con la plantilla *Propuesta de feature* y escribe ahí el spec.
2. **Se discute en el issue** hasta que no queden ambigüedades. Aquí es donde se decide el alcance, los umbrales, los casos borde y lo que queda fuera.
3. **Abre un PR** con dos cosas: el archivo `specs/NNN-slug/spec.md` ya limpio y la implementación.
4. **El review cubre ambos**: que el código haga lo que dice el spec, y que el spec siga siendo fiel a lo acordado.

El spec no se queda en el issue: viaja en el PR como archivo. El issue es la conversación; el spec es el resultado de esa conversación.

## ¿Cuándo necesito un spec?

**Sí necesitan spec:**

- Features nuevas.
- Cambios en el comportamiento visible de la app.
- Cambios en cómo se calculan, filtran o muestran los horarios.

**No necesitan spec** (abre el PR directo, describiendo el problema y la solución):

- Bugfixes.
- Refactors sin cambio de comportamiento.
- Actualización de datos del ciclo (`consulta_horario.pdf` → `courses.json` → migración de oferta).
- Typos, documentación, tooling y CI.

Si dudas, abre el issue igual: es barato y evita implementar tres días sobre un supuesto equivocado.

## El spec

### Dónde vive

```
specs/NNN-slug/spec.md
```

- `NNN`: correlativo de tres dígitos (`001`, `002`, …).
- `slug`: kebab-case corto y descriptivo.
- La rama de trabajo se llama igual que la carpeta: `001-bloques-libres`.

Ejemplo canónico, léelo antes de escribir el tuyo: [`specs/001-bloques-libres/spec.md`](specs/001-bloques-libres/spec.md).
Plantilla para copiar y rellenar: [`specs/TEMPLATE.md`](specs/TEMPLATE.md).

### Estructura

| Sección | Qué va ahí |
|---------|------------|
| **Header** | `Feature Branch`, `Created`, `Status`, `Input` (la petición original en una línea). |
| **Execution Flow (main)** | El recorrido del cambio en pasos numerados, de principio a fin. |
| **User Scenarios & Testing** | `Primary User Story` (una, en formato *Como… quiero… para…*), `Acceptance Scenarios` numerados en Given/When/Then y agrupados por tema, y `Edge Cases` en viñetas. |
| **Requirements** | `Functional Requirements` numerados `FR-001`, `FR-002`, … y agrupados por área (cálculo, visualización, persistencia…). |
| **Key Entities** | Los conceptos que introduce la feature y sus atributos. Indica cuáles son derivados y cuáles se persisten. |
| **Non-Goals** | Lo que explícitamente NO hace esta feature. |
| **Review & Acceptance Checklist** | Verificación de calidad del propio spec. |
| **Execution Status** | Progreso de redacción del spec. |

### Reglas de estilo

- **Sin detalles de implementación.** Nada de componentes, hooks, nombres de función ni clases CSS. El spec dice *qué* y *por qué*; el PR resuelve el *cómo*.
- **Cada decisión, en el elemento que le corresponde.** Es la regla que más se olvida. Si en el issue se resolvió una ambigüedad, esa resolución termina como FR, acceptance scenario, edge case o Non-Goal — **no** como una nota, un "Clarifications", un changelog de la discusión ni un bloque de preguntas y respuestas. El spec final se lee como si nunca hubiera habido dudas.
- **Sin secciones de meta-instrucciones.** Nada de "guidelines" sobre cómo escribir el spec dentro del spec.
- **Requisitos verificables.** Un requisito por línea, en `DEBE` / `NO DEBE`, numerado y con valores concretos ("mayor o igual a 120 minutos", no "un rato largo").
- **Sin ambigüedad.** Evita "o", "podría", "idealmente", "quizás". Si hay dos opciones sobre la mesa, la discusión no terminó.
- **Los Non-Goals son parte del trabajo.** Delimitar qué queda fuera evita el review interminable.

## El Pull Request

- Rama con el mismo nombre que la carpeta del spec (`001-bloques-libres`), a partir de `main`.
- Commits en español siguiendo el historial: `feat:`, `fix:`, `docs:`.
- El PR incluye el spec y enlaza el issue donde se discutió (`Closes #N`).
- `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` deben pasar. Si el PR toca `supabase/`, también `supabase db reset && pnpm test:db`: `supabase start` solo aplica migraciones y seed al crear el volumen, así que sin el reset los tests pgTAP validan el esquema anterior.
- El cuerpo del PR **no repite el spec** — el spec ya viaja en el propio PR y quien revisa lo tiene al lado. Nada de tablas que mapeen cada `FR-` a su archivo: envejecen mal y no dicen nada que el diff no diga. El cuerpo cuenta lo que *no* está en el spec:
  - qué se implementó, en un párrafo;
  - las decisiones de implementación que el spec no cubría, y por qué se tomaron así;
  - **lo que quedó incompleto o sin verificar, si quedó algo.** Un requisito sin implementar declarado en el PR es un detalle a resolver; descubierto después del merge, es un bug.

## Estilo de código

- TypeScript en todo el código nuevo.
- Componentes con `'use client'` cuando usen estado o efectos.
- Tailwind, siempre con su variante `dark:`. La app se usa mucho de noche.
- Texto de UI en español.
- Comentarios escasos: solo donde el *por qué* no se deduce del código.
- Sigue las convenciones del archivo que estás tocando antes que tus preferencias.

## Setup

Instalación y comandos, en el [README](README.md#inicio-rápido).
