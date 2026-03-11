'use client';

import { Course, SelectedCourse } from '@/types';
import { getCourseColor } from '@/lib/schedule-utils';
import { analyzeSection } from '@/lib/subsession-utils';

interface Props {
  courses: Course[];
  selectedCourses: SelectedCourse[];
  onRemoveCourse: (courseCode: string) => void;
  onChangeSection: (courseCode: string, newSection: number) => void;
  onChangeSubsession: (courseCode: string, subsessionId: string) => void;
}

export default function SelectedCoursesList({
  courses,
  selectedCourses,
  onRemoveCourse,
  onChangeSection,
  onChangeSubsession,
}: Props) {
  if (selectedCourses.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8 text-sm">
        Busca y agrega cursos para armar tu horario
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {selectedCourses.map((selected, idx) => {
        const course = courses.find(c => c.code === selected.courseCode);
        if (!course) return null;

        const section = course.sections.find(s => s.number === selected.sectionNumber);
        const analysis = section ? analyzeSection(section) : null;
        const hasSubsessions = analysis && analysis.subsessionGroups.length > 0;

        const colorClass = getCourseColor(idx);
        const bgColor = colorClass.split(' ')[0];

        return (
          <div
            key={selected.courseCode}
            className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors duration-300"
          >
            <div className={`w-3 h-3 rounded-full ${bgColor} shrink-0 dark:opacity-80`} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {course.name}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{course.code}</span>
                <select
                  value={selected.sectionNumber}
                  onChange={e => onChangeSection(course.code, parseInt(e.target.value))}
                  className="text-[11px] border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 outline-none focus:ring-1 focus:ring-blue-500/50 transition-colors duration-300"
                >
                  {course.sections.map(s => (
                    <option key={s.number} value={s.number}>
                      Sección {s.number}
                    </option>
                  ))}
                </select>
                {hasSubsessions && (
                  <select
                    value={selected.subsessionId || ''}
                    onChange={e => onChangeSubsession(course.code, e.target.value)}
                    className="text-[11px] border border-amber-200 dark:border-amber-900/40 rounded px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors"
                  >
                    {analysis.subsessionGroups.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <button
              onClick={() => onRemoveCourse(course.code)}
              className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
              title="Eliminar curso"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
