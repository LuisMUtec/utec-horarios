'use client';

import { Course } from '@/types';
import { DAY_LABELS } from '@/lib/schedule-utils';
import { analyzeSection } from '@/lib/subsession-utils';

interface Props {
  course: Course;
  selectedSection?: number;
  onSelectSection: (sectionNumber: number, subsessionId?: string) => void;
  onHoverSection: (info: {courseCode: string, sectionNumber: number, subsessionId?: string} | null) => void;
}

export default function SectionSelector({ course, selectedSection, onSelectSection, onHoverSection }: Props) {
  return (
    <div className="px-4 pb-3 space-y-2 bg-gray-50 dark:bg-gray-800/50 transition-colors duration-300">
      {course.sections.map(section => {
        const isSelected = selectedSection === section.number;
        const analysis = analyzeSection(section);
        const hasSubsessions = analysis.subsessionGroups.length > 0;
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
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
            onMouseEnter={() => onHoverSection({courseCode: course.code, sectionNumber: section.number})}
            onMouseLeave={() => onHoverSection(null)}
          >
            <div className="mb-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm dark:text-gray-200">Sección {section.number}</span>
                  {hasSubsessions && (
                    <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium border border-amber-200 dark:border-amber-800">
                      {analysis.subsessionGroups.length} subsecciones
                    </span>
                  )}
                </div>
                {!hasSubsessions && (
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
                )}
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

            {/* Mandatory sessions as fixed tags */}
            {hasSubsessions && analysis.mandatorySessions.length > 0 && (
              <div className="mb-2">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 dark:text-gray-500 mb-1">Obligatorio:</div>
                <div className="flex flex-wrap gap-1">
                  {analysis.mandatorySessions.map((sess, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-[11px] bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800"
                    >
                      <span className="font-medium">{sess.type}</span>
                      <span>{DAY_LABELS[sess.day]?.slice(0, 3) || sess.day} {sess.startTime}-{sess.endTime}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Subsession picker */}
            {hasSubsessions ? (
              <div className="mt-2">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 dark:text-gray-500 mb-1">Elige una subsección:</div>
                <div className="space-y-1">
                  {analysis.subsessionGroups.map(group => (
                    <button
                      key={group.id}
                      onClick={() => onSelectSection(section.number, group.id)}
                      onMouseEnter={() => onHoverSection({courseCode: course.code, sectionNumber: section.number, subsessionId: group.id})}
                      onMouseLeave={() => onHoverSection(null)}
                      className="w-full text-left px-2 py-1.5 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:border-blue-300 dark:hover:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-medium dark:text-gray-200">{group.label}</span>
                        <span className="text-gray-500 dark:text-gray-400 ml-2">
                          {group.sessions.map(s => `${DAY_LABELS[s.day]?.slice(0, 3) || s.day} ${s.startTime}-${s.endTime}`).join(', ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-gray-400 dark:text-gray-500">{group.enrolled}/{group.capacity}</span>
                        <span className="text-gray-400 dark:text-gray-500 hidden sm:inline truncate max-w-[120px]">{group.professor.split(',')[0]}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {section.sessions.map((sess, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-[11px] bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded border border-transparent dark:border-gray-700 transition-colors"
                  >
                    <span className="font-medium">{DAY_LABELS[sess.day]?.slice(0, 3) || sess.day}</span>
                    <span>{sess.startTime}-{sess.endTime}</span>
                    <span className="text-gray-400 dark:text-gray-500 hidden sm:inline">({sess.type})</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
