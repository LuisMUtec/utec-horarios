import { Section, Session } from '@/types';

export interface SubsessionGroup {
  id: string;                // e.g., "TEORÍA-11", "LABORATORIO-11"
  label: string;             // e.g., "TEORÍA 11"
  sessions: Session[];       // sessions in this group (can be >1 if multi-day)
  capacity: number;
  enrolled: number;
  professor: string;
  day: string;
  startTime: string;
  endTime: string;
}

export interface SectionAnalysis {
  hasMandatorySessions: boolean;
  mandatorySessions: Session[];
  subsessionGroups: SubsessionGroup[];
}

/**
 * Extract base type and number from a session type string.
 * "TEORÍA 1" → { base: "TEORÍA", num: "1" }
 * "LABORATORIO 11" → { base: "LABORATORIO", num: "11" }
 * "TEORÍA VIRTUAL 1" → { base: "TEORÍA VIRTUAL", num: "1" }
 * "TEORÍA 23.01" → { base: "TEORÍA", num: "23.01" }
 */
function parseSessionType(type: string): { base: string; num: string } {
  // Match: everything up to the last space + number (possibly with .XX suffix)
  const match = type.match(/^(.+?)\s+(\d+)(\.\d+)?$/);
  if (!match) return { base: type, num: '' };
  const base = match[1];
  const num = match[2] + (match[3] || '');
  return { base, num };
}

/**
 * Caché del análisis por sección.
 *
 * analyzeSection no es barato (regex por sesión + armado de Maps) y se llama
 * desde SectionSelector, SelectedCoursesList y getFilteredSessions, todos los
 * cuales re-renderizan al pasar el mouse por una sección. Las secciones vienen
 * de courses.json importado, así que su identidad es estable y el resultado
 * nunca cambia para la misma sección; un WeakMap deja que el GC haga su trabajo.
 */
const analysisCache = new WeakMap<Section, SectionAnalysis>();

export function analyzeSection(section: Section): SectionAnalysis {
  const cached = analysisCache.get(section);
  if (cached) return cached;
  const analysis = computeSectionAnalysis(section);
  analysisCache.set(section, analysis);
  return analysis;
}

function computeSectionAnalysis(section: Section): SectionAnalysis {
  const sessions = section.sessions;

  // Group sessions by full parsed number, so 22, 22.01 and 22.02 remain separate options.
  const parsed = sessions.map(s => ({ session: s, ...parseSessionType(s.type) }));

  // Build groups keyed by "baseType-num".
  const groupMap = new Map<string, { base: string; num: string; sessions: typeof parsed; capacity: number }>();

  for (const p of parsed) {
    if (!p.num) continue;
    const key = `${p.base}-${p.num}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, { base: p.base, num: p.num, sessions: [], capacity: p.session.capacity });
    }
    groupMap.get(key)!.sessions.push(p);
  }

  // Find global max capacity across all groups
  const allCapacities = [...groupMap.values()].map(g => g.capacity);
  const globalMaxCapacity = Math.max(...allCapacities);
  const uniqueCapacities = [...new Set(allCapacities)];

  // If only one capacity level globally, no subsession pattern
  if (uniqueCapacities.length <= 1) {
    return {
      hasMandatorySessions: false,
      mandatorySessions: sessions,
      subsessionGroups: [],
    };
  }

  const mandatorySessions: Session[] = [];
  const subsessionGroups: SubsessionGroup[] = [];

  for (const [, group] of groupMap) {
    if (group.capacity === globalMaxCapacity) {
      // Mandatory: sessions with the highest capacity
      for (const p of group.sessions) {
        mandatorySessions.push(p.session);
      }
    } else if (new Set(group.sessions.map(p => p.session.modality)).size > 1) {
      // Modalidad mixta en un mismo "Sesión Grupo": la oferta le puso la misma
      // etiqueta a dos alternativas distintas (p. ej. un lab virtual y uno
      // presencial), no a un mismo grupo que se reúne dos veces por semana.
      // Cada sesión se ofrece como opción propia para no forzar ambas.
      group.sessions.forEach((p, i) => {
        const session = p.session;
        subsessionGroups.push({
          id: `${group.base}-${group.num}-${i}`,
          label: `${group.base} ${group.num}`,
          sessions: [session],
          capacity: session.capacity,
          enrolled: session.enrolled,
          professor: session.professor,
          day: session.day,
          startTime: session.startTime,
          endTime: session.endTime,
        });
      });
    } else {
      // Subsession: lower capacity groups are selectable
      const first = group.sessions[0].session;
      const id = `${group.base}-${group.num}`;
      const label = `${group.base} ${group.num}`;
      subsessionGroups.push({
        id,
        label,
        sessions: group.sessions.map(p => p.session),
        capacity: first.capacity,
        enrolled: first.enrolled,
        professor: first.professor,
        day: first.day,
        startTime: first.startTime,
        endTime: first.endTime,
      });
    }
  }

  // Handle sessions with no parseable number
  for (const p of parsed) {
    if (!p.num) mandatorySessions.push(p.session);
  }

  return {
    hasMandatorySessions: subsessionGroups.length > 0,
    mandatorySessions,
    subsessionGroups,
  };
}

export function getFilteredSessions(section: Section, subsessionId?: string): Session[] {
  const analysis = analyzeSection(section);

  if (analysis.subsessionGroups.length === 0) {
    return section.sessions;
  }

  if (!subsessionId) {
    return analysis.mandatorySessions;
  }

  const group = analysis.subsessionGroups.find(g => g.id === subsessionId);
  return [...analysis.mandatorySessions, ...(group?.sessions || [])];
}
