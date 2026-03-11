'use client';

import { Course } from '@/types';
import { DAY_LABELS } from '@/lib/schedule-utils';

interface Props {
  course: Course;
  selectedSection?: number;
  onSelectSection: (sectionNumber: number) => void;
  onHoverSection: (info: {courseCode: string, sectionNumber: number} | null) => void;
}

export default function SectionSelector({ course, selectedSection, onSelectSection, onHoverSection }: Props) {
  return (
    <div className="px-4 pb-3 space-y-2 bg-gray-50 dark:bg-gray-800/50 transition-colors duration-300">
      {course.sections.map(section => {
        const isSelected = selectedSection === section.number;
        const professors = [...new Set(section.sessions.map(s => s.professor))];
        const modalities = [...new Set(section.sessions.map(s => s.modality))];
        const capacity = section.sessions[0]?.capacity ?? 0;
        const enrolled = section.sessions[0]?.enrolled ?? 0;

        return (
          <div
            key={section.number}
            className={`border rounded-lg p-3 transition-colors duration-300 ${
              isSelected
                ? 'border-blue-400 dark:border-blue-500/50 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
            onMouseEnter={() => onHoverSection({courseCode: course.code, sectionNumber: section.number})}
            onMouseLeave={() => onHoverSection(null)}
          >
            <div className="mb-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm dark:text-gray-200">Sección {section.number}</span>
                <button
                  onClick={() => onSelectSection(section.number)}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-colors shrink-0 ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:text-blue-700 dark:hover:text-blue-300'
                  }`}
                >
                  {isSelected ? 'Seleccionado' : 'Seleccionar'}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {modalities.join(' / ')}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  ({enrolled}/{capacity} matriculados)
                </span>
              </div>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              {professors.join(' / ')}
            </div>

            <div className="flex flex-wrap gap-1">
              {section.sessions.map((sess, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded transition-colors duration-300"
                >
                  <span className="font-medium">{DAY_LABELS[sess.day]?.slice(0, 3) || sess.day}</span>
                  <span>{sess.startTime}-{sess.endTime}</span>
                  <span className="text-gray-400 dark:text-gray-500 hidden sm:inline">({sess.type})</span>
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
