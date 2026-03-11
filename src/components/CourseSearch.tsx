'use client';

import { useState, useMemo } from 'react';
import { Course, SelectedCourse } from '@/types';
import { searchCourses } from '@/lib/schedule-utils';
import SectionSelector from './SectionSelector';

interface Props {
  courses: Course[];
  selectedCourses: SelectedCourse[];
  onAddCourse: (courseCode: string, sectionNumber: number, subsessionId?: string) => void;
  onHoverSection: (info: {courseCode: string, sectionNumber: number, subsessionId?: string} | null) => void;
}

export default function CourseSearch({ courses, selectedCourses, onAddCourse, onHoverSection }: Props) {
  const [query, setQuery] = useState('');
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  const results = useMemo(() => searchCourses(courses, query), [courses, query]);

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
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setExpandedCourse(null); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            &times;
          </button>
        )}
      </div>

      {results.length > 0 && (
        <div className="mt-2 border border-gray-200 rounded-lg max-h-96 overflow-y-auto bg-white shadow-sm">
          {results.map(course => (
            <div key={course.code} className="border-b border-gray-100 last:border-0">
              <button
                onClick={() =>
                  setExpandedCourse(expandedCourse === course.code ? null : course.code)
                }
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between gap-2 ${
                  isSelected(course.code) ? 'bg-blue-50' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-500">{course.code}</span>
                    <span className="text-xs text-gray-400">
                      · {course.sections.length} {course.sections.length === 1 ? 'sección' : 'secciones'}
                    </span>
                    {isSelected(course.code) && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        Agregado
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">
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
                  onSelectSection={(sectionNum, subsessionId) => {
                    onAddCourse(course.code, sectionNum, subsessionId);
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
