import { CalendarEvent, Course, SelectedCourse, Session } from '@/types';

const COURSE_COLORS = [
  'bg-blue-100 border-blue-400 text-blue-900',
  'bg-emerald-100 border-emerald-400 text-emerald-900',
  'bg-violet-100 border-violet-400 text-violet-900',
  'bg-amber-100 border-amber-400 text-amber-900',
  'bg-rose-100 border-rose-400 text-rose-900',
  'bg-cyan-100 border-cyan-400 text-cyan-900',
  'bg-orange-100 border-orange-400 text-orange-900',
  'bg-pink-100 border-pink-400 text-pink-900',
  'bg-teal-100 border-teal-400 text-teal-900',
  'bg-indigo-100 border-indigo-400 text-indigo-900',
  'bg-lime-100 border-lime-400 text-lime-900',
  'bg-fuchsia-100 border-fuchsia-400 text-fuchsia-900',
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

    for (const session of section.sessions) {
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

export function getPreviewEvents(
  courses: Course[],
  courseCode: string,
  sectionNumber: number,
  colorIndex: number
): CalendarEvent[] {
  const course = courses.find(c => c.code === courseCode);
  if (!course) return [];

  const section = course.sections.find(s => s.number === sectionNumber);
  if (!section) return [];

  const color = getCourseColor(colorIndex);

  return section.sessions.map(session => ({
    courseCode: course.code,
    courseName: course.name,
    session,
    color,
    isPreview: true,
  }));
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

export function searchCourses(courses: Course[], query: string): Course[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase().trim();
  return courses.filter(
    c =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q)
  ).slice(0, 20);
}
