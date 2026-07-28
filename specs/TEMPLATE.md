# Feature Specification: [NOMBRE DE LA FEATURE]

**Feature Branch**: `NNN-slug`
**Created**: AAAA-MM-DD
**Status**: Draft
**Input**: "[La petición original, en una o dos líneas]"

## Execution Flow (main)

```
1. [Paso inicial, normalmente algo que ya existe]
2. [...]
3. [Paso final: qué ve o consigue el usuario]
```

---

## User Scenarios & Testing

### Primary User Story

Como [tipo de usuario], quiero [capacidad], para [beneficio concreto].

### Acceptance Scenarios

**[Grupo temático, ej. Cálculo y visualización]**

1. **Given** [estado inicial], **When** [acción], **Then** [resultado observable].
2. **Given** [...], **When** [...], **Then** [...].

**[Otro grupo temático, ej. Persistencia]**

3. **Given** [...], **When** [...], **Then** [...].

> Cada escenario debe poder verificarse mirando la app. Si no sabrías decir si pasó o falló, reescríbelo.

### Edge Cases

- **[Caso borde]**: [comportamiento esperado].
- **[Estado vacío]**: [qué se muestra cuando no hay datos].
- **[Modo claro y oscuro]**: [si aplica].

---

## Requirements

### Functional Requirements

#### [Área, ej. Cálculo]

- **FR-001**: El sistema DEBE [comportamiento verificable, con valores concretos].
- **FR-002**: El sistema NO DEBE [comportamiento excluido].

#### [Área, ej. Visualización]

- **FR-003**: [...]

#### [Área, ej. Control de usuario y persistencia]

- **FR-004**: [...]

### Key Entities

- **[Entidad]**: [qué representa]. Atributos: [...]. [Derivada — no se persiste. / Se persiste en el navegador.]

---

## Non-Goals (fuera de alcance)

- [Lo que alguien podría asumir que entra y no entra.]
- [Decisiones postergadas a una versión futura.]

---

## Review & Acceptance Checklist

### Content Quality

- [ ] Sin detalles de implementación (lenguajes, frameworks, APIs)
- [ ] Enfocado en valor para el usuario y necesidades de negocio
- [ ] Escrito para stakeholders no técnicos
- [ ] Todas las secciones obligatorias completas

### Requirement Completeness

- [ ] Sin marcadores `[NEEDS CLARIFICATION]` pendientes
- [ ] Requisitos verificables y sin ambigüedad
- [ ] Criterios de éxito medibles
- [ ] Alcance claramente delimitado
- [ ] Dependencias y supuestos identificados

---

## Execution Status

- [ ] Descripción del usuario procesada
- [ ] Conceptos clave extraídos
- [ ] Ambigüedades resueltas
- [ ] Escenarios de usuario definidos
- [ ] Requisitos generados
- [ ] Entidades identificadas
- [ ] Revisión del checklist superada
