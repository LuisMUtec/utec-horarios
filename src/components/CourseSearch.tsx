'use client';

import { useState, useMemo } from 'react';
import { Course, SelectedCourse } from '@/types';
import { searchCourses } from '@/lib/schedule-utils';
import SectionSelector from './SectionSelector';

interface Props {
  courses: Course[];
  selectedCourses: SelectedCourse[];
  onAddCourse: (courseCode: string, sectionNumber: number) => void;
  onHoverSection: (info: {courseCode: string, sectionNumber: number} | null) => void;
}

export default function CourseSearch({ courses, selectedCourses, onAddCourse, onHoverSection }: Props) {
  const [query, setQuery] = useState('');
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  const results = useMemo(() => searchCourses(courses, query), [courses, query]);

  const suggestions = useMemo(() => {
    if (query.length >= 2) return [];
    // If the user has uploaded Carga Hábil, this courses array is already filtered by it outside.
    return courses.slice(0, 8);
  }, [courses, query]);

  const displayList = query.length >= 2 ? results : suggestions;
  const isSuggesting = query.length < 2 && suggestions.length > 0;

  const isSelected = (code: string) =>
    selectedCourses.some(s => s.courseCode === code);

  return (
    <div>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setExpandedCourse(null);
          }}
          placeholder="Buscar por nombre o código (ej: CS2023, Algoritmos)"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm transition-colors duration-300"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setExpandedCourse(null); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            &times;
          </button>
        )}
      </div>

      {displayList.length > 0 && (
        <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg max-h-96 overflow-y-auto bg-white dark:bg-gray-800 shadow-sm transition-colors duration-300">
          {isSuggesting && (
             <div className="sticky top-0 z-10 px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                Sugerencias ({courses.length} disponibles)
             </div>
          )}
          {displayList.map(course => (
            <div key={course.code} className="border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors duration-300">
              <button
                onClick={() =>
                  setExpandedCourse(expandedCourse === course.code ? null : course.code)
                }
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between gap-2 transition-colors duration-300 ${
                  isSelected(course.code) ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{course.code}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      · {course.sections.length} {course.sections.length === 1 ? 'sección' : 'secciones'}
                    </span>
                    {isSelected(course.code) && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                        Agregado
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {course.name}
                  </p>
                </div>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${
                    expandedCourse === course.code ? 'rotate-180' : ''
                  }`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expandedCourse === course.code && (
                <SectionSelector
                  course={course}
                  selectedSection={
                    selectedCourses.find(s => s.courseCode === course.code)?.sectionNumber
                  }
                  onSelectSection={(sectionNum) => {
                    onAddCourse(course.code, sectionNum);
                  }}
                  onHoverSection={onHoverSection}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {query.length >= 2 && results.length === 0 && (
        <p className="mt-2 text-sm text-gray-500 text-center py-4">
          No se encontraron cursos para &quot;{query}&quot;
        </p>
      )}
    </div>
  );
}
