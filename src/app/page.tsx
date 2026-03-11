'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import coursesData from '@/data/courses.json';
import { Course, SelectedCourse } from '@/types';
import { getCalendarEvents, getPreviewEvents, checkNewCourseConflict } from '@/lib/schedule-utils';
import { loadSelectedCourses, saveSelectedCourses } from '@/lib/storage';
import { analyzeSection } from '@/lib/subsession-utils';
import CourseSearch from '@/components/CourseSearch';
import SelectedCoursesList from '@/components/SelectedCoursesList';
import WeeklyCalendar from '@/components/WeeklyCalendar';
import ThemeToggle from '@/components/ThemeToggle';
import ToastAlert from '@/components/ToastAlert';
import { useRef } from 'react';

const courses = coursesData as Course[];

function autoAssignSubsession(selected: SelectedCourse): SelectedCourse {
  if (selected.subsessionId) return selected;
  const course = courses.find(c => c.code === selected.courseCode);
  if (!course) return selected;
  const section = course.sections.find(s => s.number === selected.sectionNumber);
  if (!section) return selected;
  const analysis = analyzeSection(section);
  if (analysis.subsessionGroups.length > 0) {
    return { ...selected, subsessionId: analysis.subsessionGroups[0].id };
  }
  return selected;
}

export default function Home() {
  const [selectedCourses, setSelectedCourses] = useState<SelectedCourse[]>([]);
  const [mounted, setMounted] = useState(false);
  const [previewSection, setPreviewSection] = useState<{courseCode: string, sectionNumber: number, subsessionId?: string} | null>(null);
  const [cargaHabilCodes, setCargaHabilCodes] = useState<string[] | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [courseTipos, setCourseTipos] = useState<Record<string, string> | null>(null);
  
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info'; id: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((message: string, type: 'error' | 'success' | 'info' = 'error') => {
    setToast({ message, type, id: Date.now() });
  }, []);

  useEffect(() => {
    // Migration: auto-assign subsessionId for old data that lacks it
    const loaded = loadSelectedCourses().map(autoAssignSubsession);
    setSelectedCourses(loaded);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      saveSelectedCourses(selectedCourses);
    }
  }, [selectedCourses, mounted]);

  const handleAddCourse = useCallback((courseCode: string, sectionNumber: number, subsessionId?: string) => {
    setSelectedCourses(prev => {
      const newSelected: SelectedCourse = { courseCode, sectionNumber, subsessionId };
      const withSubsession = autoAssignSubsession(newSelected);
      const existing = prev.findIndex(s => s.courseCode === courseCode);
      const conflictCheck = checkNewCourseConflict(courses, prev, courseCode, sectionNumber, courseCode);
      
      if (conflictCheck.hasConflict) {
        showToast(`No se puede agregar porque hay un cruce de horario con: ${conflictCheck.conflictingCourseName}`, 'error');
        return prev;
      }

      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = withSubsession;
        return updated;
      }
      return [...prev, withSubsession];
    });
  }, [showToast]);

  const handleRemoveCourse = useCallback((courseCode: string) => {
    setSelectedCourses(prev => prev.filter(s => s.courseCode !== courseCode));
  }, []);

  const handleChangeSection = useCallback((courseCode: string, newSection: number) => {
    setSelectedCourses(prev => {
      const conflictCheck = checkNewCourseConflict(courses, prev, courseCode, newSection, courseCode);
      
      if (conflictCheck.hasConflict) {
        showToast(`No se puede cambiar de sección porque hay un cruce de horario con: ${conflictCheck.conflictingCourseName}`, 'error');
        return prev;
      }

      return prev.map(s => {
        if (s.courseCode !== courseCode) return s;
        // Reset subsessionId and auto-assign for new section
        return autoAssignSubsession({ courseCode, sectionNumber: newSection });
      });
    });
  }, [showToast]);

  const handleChangeSubsession = useCallback((courseCode: string, subsessionId: string) => {
    setSelectedCourses(prev =>
      prev.map(s =>
        s.courseCode === courseCode ? { ...s, subsessionId } : s
      )
    );
  }, []);

  const events = getCalendarEvents(courses, selectedCourses);

  const previewEvents = previewSection
    ? getPreviewEvents(
        courses,
        previewSection.courseCode,
        previewSection.sectionNumber,
        (() => {
          const idx = selectedCourses.findIndex(s => s.courseCode === previewSection.courseCode);
          return idx >= 0 ? idx : selectedCourses.length;
        })(),
        previewSection.subsessionId
      )
    : [];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showToast('Procesando PDF de Carga Hábil...', 'info');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/parse-pdf', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setCargaHabilCodes(data.codes);
        setStudentName(data.studentName || null);
        setCourseTipos(data.courseTipos && Object.keys(data.courseTipos).length > 0 ? data.courseTipos : null);
        showToast(`Carga Hábil procesada. Se encontraron ${data.codes.length} cursos permitidos.`, 'success');
      } else {
        showToast(data.error || 'Error al procesar el PDF.', 'error');
      }
    } catch {
      showToast('Error de conexión al procesar el PDF.', 'error');
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const displayedCourses = useMemo(() => {
    const filtered = cargaHabilCodes
      ? courses.filter(c => cargaHabilCodes.includes(c.code))
      : courses;
    if (!courseTipos) return filtered;
    return [...filtered].sort((a, b) => {
      const tipoOrder = (code: string) => {
        const tipo = courseTipos[code];
        if (tipo === 'Obligatorio') return 0;
        if (tipo === 'Electivo') return 1;
        return 2;
      };
      return tipoOrder(a.code) - tipoOrder(b.code);
    });
  }, [cargaHabilCodes, courseTipos]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-4 transition-colors duration-300">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">UTEC Horarios</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
               {studentName ? `¡Hola, ${studentName}! • ` : ''}Periodo 2026-1
            </p>
          </div>
          <div className="flex items-center gap-4">
            <input 
              type="file" 
              accept=".pdf" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="hidden sm:flex items-center gap-2 text-xs font-medium px-3 py-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800/60 transition-colors border border-blue-200 dark:border-blue-800"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>{cargaHabilCodes ? 'Cambiar PDF' : 'Subir Carga Hábil'}</span>
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-4">
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 transition-colors duration-300 relative">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Buscar cursos</h2>
                {cargaHabilCodes && (
                  <button onClick={() => { setCargaHabilCodes(null); setStudentName(null); setCourseTipos(null); }} className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-500">
                    Remover filtro Carga Hábil
                  </button>
                )}
              </div>
              <CourseSearch
                courses={displayedCourses}
                selectedCourses={selectedCourses}
                onAddCourse={handleAddCourse}
                onHoverSection={setPreviewSection}
              />
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 transition-colors duration-300">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Cursos seleccionados ({selectedCourses.length})
                </h2>
                {selectedCourses.length > 0 && (
                  <button
                    onClick={() => setSelectedCourses([])}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Limpiar todo
                  </button>
                )}
              </div>
              <SelectedCoursesList
                courses={courses}
                selectedCourses={selectedCourses}
                onRemoveCourse={handleRemoveCourse}
                onChangeSection={handleChangeSection}
                onChangeSubsession={handleChangeSubsession}
              />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 transition-colors duration-300">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Horario semanal</h2>
            <WeeklyCalendar events={events} previewEvents={previewEvents} />
          </div>
        </div>
      </main>

      {toast && (
        <ToastAlert
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
