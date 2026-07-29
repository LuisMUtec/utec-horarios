'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { Course } from '@/types';
import { DAY_LABELS } from '@/lib/schedule-utils';
import { analyzeSection } from '@/lib/subsession-utils';
import { fetchCourseSummaries } from '@/lib/api-client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import {
  CourseSummaryState,
  SectionTeacher,
  canOpenDetail,
  indexSummaries,
  sectionTeachers,
  teacherSummaryState,
} from '@/lib/section-teachers';
import TeacherSummary from './reviews/TeacherSummary';
import ReviewsPanel from './reviews/ReviewsPanel';

interface Props {
  course: Course;
  selectedSection?: number;
  selectedSubsessionId?: string;
  onSelectSection: (sectionNumber: number, subsessionId?: string) => void;
  onRemoveCourse: (courseCode: string) => void;
  onHoverSection: (info: {courseCode: string, sectionNumber: number, subsessionId?: string} | null) => void;
}

/**
 * Un pedido por curso al desplegarlo, no uno por docente (D1). El estado es
 * local al componente: nada de esto toca la selección ni localStorage (FR-012).
 */
function useCourseSummaries(courseCode: string): [CourseSummaryState, () => void] {
  const [state, setState] = useState<CourseSummaryState>(() =>
    isSupabaseConfigured() ? { kind: 'loading' } : { kind: 'disabled' }
  );
  // Publicar invalida la caché del curso; esto es lo que vuelve a pedirlo. Sin
  // los dos, el autor ve su propio promedio viejo hasta recargar (SC-005).
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(v => v + 1), []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    // No hace falta volver a 'loading' al cambiar de curso: CourseSearch monta un
    // SectionSelector por curso desplegado, así que courseCode no cambia en vida
    // de la instancia y el estado inicial ya es el correcto. Al refrescar tampoco:
    // el resumen viejo se queda hasta que llegue el nuevo, sin parpadeo.
    let active = true;
    fetchCourseSummaries(courseCode).then(
      summaries => { if (active) setState({ kind: 'ready', byPairKey: indexSummaries(summaries) }); },
      () => { if (active) setState({ kind: 'error' }); }
    );
    return () => { active = false; };
  }, [courseCode, version]);

  return [state, refresh];
}

interface TeacherRowProps {
  courseCode: string;
  teacher: SectionTeacher;
  summaries: CourseSummaryState;
  withNames: boolean;
  onPublished: () => void;
}

/**
 * Un docente y, si se despliega, sus comentarios. El estado de apertura es por
 * fila y no del curso: dos docentes de la misma sección se comparan mejor con
 * los dos detalles abiertos.
 */
function TeacherRow({ courseCode, teacher, summaries, withNames, onPublished }: TeacherRowProps) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  const state = teacherSummaryState(teacher, summaries);
  const detail = canOpenDetail(teacher, state)
    ? { expanded, panelId, onToggle: () => setExpanded(open => !open) }
    : undefined;

  return (
    <div>
      {withNames && teacher.name && (
        <div className="text-xs text-gray-500 dark:text-gray-400">{teacher.name}</div>
      )}
      {state && <TeacherSummary teacherName={teacher.name} state={state} detail={detail} />}
      {expanded && teacher.email && (
        <div id={panelId}>
          <ReviewsPanel
            courseCode={courseCode}
            teacherEmail={teacher.email}
            teacherName={teacher.name}
            onPublished={onPublished}
          />
        </div>
      )}
    </div>
  );
}

interface TeacherRowsProps {
  courseCode: string;
  teachers: SectionTeacher[];
  summaries: CourseSummaryState;
  /** La tarjeta de subsección ya imprime su docente; la sección no. */
  withNames?: boolean;
  onPublished: () => void;
}

function TeacherRows({ courseCode, teachers, summaries, withNames = false, onPublished }: TeacherRowsProps) {
  if (teachers.length === 0) return null;

  // Sin Supabase la sección se ve igual que antes de las reseñas (T037).
  if (summaries.kind === 'disabled') {
    if (!withNames) return null;
    return (
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
        {teachers.map(t => t.name).filter(Boolean).join(' / ')}
      </div>
    );
  }

  return (
    <div className={withNames ? 'mb-1 space-y-1' : 'mt-1 space-y-0.5'}>
      {teachers.map(teacher => (
        <TeacherRow
          key={teacher.key}
          courseCode={courseCode}
          teacher={teacher}
          summaries={summaries}
          withNames={withNames}
          onPublished={onPublished}
        />
      ))}
    </div>
  );
}

export default function SectionSelector({ course, selectedSection, selectedSubsessionId, onSelectSection, onRemoveCourse, onHoverSection }: Props) {
  const [summaries, refreshSummaries] = useCourseSummaries(course.code);

  return (
    <div className="px-4 pb-3 space-y-2 bg-gray-50 dark:bg-gray-800/50 transition-colors duration-300">
      {course.sections.map(section => {
        const isSelected = selectedSection === section.number;
        const analysis = analyzeSection(section);
        const hasSubsessions = analysis.subsessionGroups.length > 0;
        const teachers = sectionTeachers(
          course.code,
          hasSubsessions ? analysis.mandatorySessions : section.sessions
        );
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
                    onClick={() => isSelected ? onRemoveCourse(course.code) : onSelectSection(section.number)}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-colors shrink-0 ${
                      isSelected
                        ? 'bg-blue-600 text-white hover:bg-red-500'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:text-blue-700 dark:hover:text-blue-300'
                    }`}
                  >
                    {isSelected ? 'Deseleccionar' : 'Seleccionar'}
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

            <TeacherRows
              courseCode={course.code}
              teachers={teachers}
              summaries={summaries}
              withNames
              onPublished={refreshSummaries}
            />

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
                <div className="space-y-1.5">
                  {analysis.subsessionGroups.map(group => {
                    const isSubSelected = isSelected && selectedSubsessionId === group.id;
                    return (
                      <div
                        key={group.id}
                        onMouseEnter={() => onHoverSection({courseCode: course.code, sectionNumber: section.number, subsessionId: group.id})}
                        onMouseLeave={() => onHoverSection(null)}
                        className={`w-full text-left px-2.5 py-2 text-xs rounded-md border transition-all ${
                          isSubSelected
                            ? 'border-blue-400 dark:border-blue-500/50 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:border-blue-300 dark:hover:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                        }`}
                      >
                        <div className="font-semibold dark:text-gray-200">{group.label}</div>
                        <div className="text-gray-500 dark:text-gray-400 mt-0.5">
                          {group.sessions.map(s => `${DAY_LABELS[s.day]?.slice(0, 3) || s.day} ${s.startTime}-${s.endTime}`).join(', ')}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-gray-400 dark:text-gray-500">
                          <span>{group.enrolled}/{group.capacity}</span>
                          <span className="truncate">{group.professor.split(',')[0]}</span>
                        </div>
                        {/* Sin descontar los de la cabecera: cada subsección es
                            una opción elegible y necesita su propio resumen,
                            aunque el docente sea el mismo de la obligatoria. */}
                        <TeacherRows
                          courseCode={course.code}
                          teachers={sectionTeachers(course.code, group.sessions)}
                          summaries={summaries}
                          onPublished={refreshSummaries}
                        />
                        <div className="mt-1.5">
                          <button
                            onClick={() => isSubSelected ? onRemoveCourse(course.code) : onSelectSection(section.number, group.id)}
                            className={`px-3 py-1 text-[11px] rounded-md font-medium transition-colors ${
                              isSubSelected
                                ? 'bg-blue-600 text-white hover:bg-red-500'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:text-blue-700 dark:hover:text-blue-300'
                            }`}
                          >
                            {isSubSelected ? 'Deseleccionar' : 'Seleccionar'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
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
