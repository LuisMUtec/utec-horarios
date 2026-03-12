import { CalendarEvent, Course, SelectedCourse, Session } from '@/types';
import { getFilteredSessions } from './subsession-utils';

const COURSE_COLORS = [
  'bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-100',
  'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-400 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100',
  'bg-violet-100 dark:bg-violet-900/40 border-violet-400 dark:border-violet-700 text-violet-900 dark:text-violet-100',
  'bg-amber-100 dark:bg-amber-900/40 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-100',
  'bg-rose-100 dark:bg-rose-900/40 border-rose-400 dark:border-rose-700 text-rose-900 dark:text-rose-100',
  'bg-cyan-100 dark:bg-cyan-900/40 border-cyan-400 dark:border-cyan-700 text-cyan-900 dark:text-cyan-100',
  'bg-orange-100 dark:bg-orange-900/40 border-orange-400 dark:border-orange-700 text-orange-900 dark:text-orange-100',
  'bg-pink-100 dark:bg-pink-900/40 border-pink-400 dark:border-pink-700 text-pink-900 dark:text-pink-100',
  'bg-teal-100 dark:bg-teal-900/40 border-teal-400 dark:border-teal-700 text-teal-900 dark:text-teal-100',
  'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-400 dark:border-indigo-700 text-indigo-900 dark:text-indigo-100',
  'bg-lime-100 dark:bg-lime-900/40 border-lime-400 dark:border-lime-700 text-lime-900 dark:text-lime-100',
  'bg-fuchsia-100 dark:bg-fuchsia-900/40 border-fuchsia-400 dark:border-fuchsia-700 text-fuchsia-900 dark:text-fuchsia-100',
];

export function getCourseColor(index: number): string {
  return COURSE_COLORS[index % COURSE_COLORS.length];
}

export function getCalendarEvents(
  courses: Course[],
  selectedCourses: SelectedCourse[]
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  selectedCourses.forEach((selected, idx) => {
    const course = courses.find(c => c.code === selected.courseCode);
    if (!course) return;

    const section = course.sections.find(s => s.number === selected.sectionNumber);
    if (!section) return;

    const color = getCourseColor(idx);
    const filteredSessions = getFilteredSessions(section, selected.subsessionId);

    for (const session of filteredSessions) {
      events.push({
        courseCode: course.code,
        courseName: course.name,
        session,
        color,
      });
    }
  });

  return events;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function hasConflict(a: Session, b: Session): boolean {
  if (a.day !== b.day) return false;
  const aStart = timeToMinutes(a.startTime);
  const aEnd = timeToMinutes(a.endTime);
  const bStart = timeToMinutes(b.startTime);
  const bEnd = timeToMinutes(b.endTime);
  return aStart < bEnd && bStart < aEnd;
}

export function findConflicts(events: CalendarEvent[]): Set<string> {
  const conflictIds = new Set<string>();

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      if (events[i].courseCode === events[j].courseCode) continue;
      if (hasConflict(events[i].session, events[j].session)) {
        conflictIds.add(`${i}`);
        conflictIds.add(`${j}`);
      }
    }
  }

  return conflictIds;
}

export function checkNewCourseConflict(
  courses: Course[],
  selectedCourses: SelectedCourse[],
  newCourseCode: string,
  newSectionNumber: number,
  newSubsessionId?: string,
  ignoreCourseCode?: string
): { hasConflict: boolean; conflictingCourseName?: string } {
  const newCourse = courses.find(c => c.code === newCourseCode);
  if (!newCourse) return { hasConflict: false };

  const newSection = newCourse.sections.find(s => s.number === newSectionNumber);
  if (!newSection) return { hasConflict: false };
  const newSessions = getFilteredSessions(newSection, newSubsessionId);

  for (const selected of selectedCourses) {
    if (selected.courseCode === ignoreCourseCode) continue;
    
    const existingCourse = courses.find(c => c.code === selected.courseCode);
    if (!existingCourse) continue;

    const existingSection = existingCourse.sections.find(s => s.number === selected.sectionNumber);
    if (!existingSection) continue;
    const existingSessions = getFilteredSessions(existingSection, selected.subsessionId);

    for (const newSession of newSessions) {
      for (const existingSession of existingSessions) {
        if (hasConflict(newSession, existingSession)) {
          return { hasConflict: true, conflictingCourseName: existingCourse.name };
        }
      }
    }
  }

  return { hasConflict: false };
}

export function getPreviewEvents(
  courses: Course[],
  courseCode: string,
  sectionNumber: number,
  colorIndex: number,
  subsessionId?: string
): CalendarEvent[] {
  const course = courses.find(c => c.code === courseCode);
  if (!course) return [];

  const section = course.sections.find(s => s.number === sectionNumber);
  if (!section) return [];

  const color = getCourseColor(colorIndex);
  const filteredSessions = getFilteredSessions(section, subsessionId);

  return filteredSessions.map(session => ({
    courseCode: course.code,
    courseName: course.name,
    session,
    color,
    isPreview: true,
  }));
}

export interface OverlapLayout {
  column: number;
  totalColumns: number;
}

export function computeOverlapLayout(
  dayEvents: { event: CalendarEvent; idx: number }[]
): Map<number, OverlapLayout> {
  const result = new Map<number, OverlapLayout>();
  if (dayEvents.length === 0) return result;

  // Sort by start time, then by end time
  const sorted = [...dayEvents].sort((a, b) => {
    const aStart = timeToMinutes(a.event.session.startTime);
    const bStart = timeToMinutes(b.event.session.startTime);
    if (aStart !== bStart) return aStart - bStart;
    return timeToMinutes(a.event.session.endTime) - timeToMinutes(b.event.session.endTime);
  });

  // Build overlap clusters (groups of transitively overlapping events)
  const clusters: typeof sorted[] = [];
  let currentCluster: typeof sorted = [sorted[0]];
  let clusterEnd = timeToMinutes(sorted[0].event.session.endTime);

  for (let i = 1; i < sorted.length; i++) {
    const start = timeToMinutes(sorted[i].event.session.startTime);
    if (start < clusterEnd) {
      // Overlaps with current cluster
      currentCluster.push(sorted[i]);
      clusterEnd = Math.max(clusterEnd, timeToMinutes(sorted[i].event.session.endTime));
    } else {
      clusters.push(currentCluster);
      currentCluster = [sorted[i]];
      clusterEnd = timeToMinutes(sorted[i].event.session.endTime);
    }
  }
  clusters.push(currentCluster);

  // Assign columns within each cluster
  for (const cluster of clusters) {
    // columns[col] = end time of the last event placed in that column
    const columns: number[] = [];

    for (const item of cluster) {
      const itemStart = timeToMinutes(item.event.session.startTime);
      // Find the first column where the event fits (no overlap)
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        if (itemStart >= columns[col]) {
          columns[col] = timeToMinutes(item.event.session.endTime);
          result.set(item.idx, { column: col, totalColumns: 0 }); // totalColumns set later
          placed = true;
          break;
        }
      }
      if (!placed) {
        result.set(item.idx, { column: columns.length, totalColumns: 0 });
        columns.push(timeToMinutes(item.event.session.endTime));
      }
    }

    // Set totalColumns for all events in this cluster
    const total = columns.length;
    for (const item of cluster) {
      const layout = result.get(item.idx)!;
      layout.totalColumns = total;
    }
  }

  return result;
}

export const DAYS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'] as const;
export const DAY_LABELS: Record<string, string> = {
  Lun: 'Lunes',
  Mar: 'Martes',
  Mie: 'Miércoles',
  Jue: 'Jueves',
  Vie: 'Viernes',
  Sab: 'Sábado',
};

export const START_HOUR = 7;
export const END_HOUR = 22;

function normalize(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function searchCourses(courses: Course[], query: string): Course[] {
  if (!query || query.length < 2) return [];
  const words = normalize(query).split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return [];
  return courses.filter(c => {
    const text = normalize(c.code) + ' ' + normalize(c.name);
    return words.every(w => text.includes(w));
  }).slice(0, 20);
}
