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
    <div className="px-4 pb-3 space-y-2 bg-gray-50">
      {course.sections.map(section => {
        const isSelected = selectedSection === section.number;
        const professors = [...new Set(section.sessions.map(s => s.professor))];
        const modalities = [...new Set(section.sessions.map(s => s.modality))];
        const capacity = section.sessions[0]?.capacity ?? 0;
        const enrolled = section.sessions[0]?.enrolled ?? 0;

        return (
          <div
            key={section.number}
            className={`border rounded-lg p-3 ${
              isSelected
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
            onMouseEnter={() => onHoverSection({courseCode: course.code, sectionNumber: section.number})}
            onMouseLeave={() => onHoverSection(null)}
          >
            <div className="mb-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">Sección {section.number}</span>
                <button
                  onClick={() => onSelectSection(section.number)}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-colors shrink-0 ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700'
                  }`}
                >
                  {isSelected ? 'Seleccionado' : 'Seleccionar'}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500">
                  {modalities.join(' / ')}
                </span>
                <span className="text-xs text-gray-400">
                  ({enrolled}/{capacity} matriculados)
                </span>
              </div>
            </div>

            <div className="text-xs text-gray-500 mb-1">
              {professors.join(' / ')}
            </div>

            <div className="flex flex-wrap gap-1">
              {section.sessions.map((sess, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                >
                  <span className="font-medium">{DAY_LABELS[sess.day]?.slice(0, 3) || sess.day}</span>
                  <span>{sess.startTime}-{sess.endTime}</span>
                  <span className="text-gray-400 hidden sm:inline">({sess.type})</span>
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
