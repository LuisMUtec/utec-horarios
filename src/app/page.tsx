'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toBlob } from 'html-to-image';
import coursesData from '@/data/courses.json';
import { Course, SelectedCourse } from '@/types';
import { getCalendarEvents, getPreviewEvents, checkNewCourseConflict } from '@/lib/schedule-utils';
import { loadSelectedCourses, saveSelectedCourses, loadAllowConflicts, saveAllowConflicts } from '@/lib/storage';
import { analyzeSection } from '@/lib/subsession-utils';
import CourseSearch from '@/components/CourseSearch';
import SelectedCoursesList from '@/components/SelectedCoursesList';
import WeeklyCalendar from '@/components/WeeklyCalendar';
import ThemeToggle from '@/components/ThemeToggle';
import ToastAlert from '@/components/ToastAlert';
import FeedbackButton from '@/components/FeedbackButton';

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
  
  const [allowConflicts, setAllowConflicts] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info'; id: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);

  const showToast = useCallback((message: string, type: 'error' | 'success' | 'info' = 'error') => {
    setToast({ message, type, id: Date.now() });
  }, []);

  useEffect(() => {
    // Migration: auto-assign subsessionId for old data that lacks it
    const loaded = loadSelectedCourses().map(autoAssignSubsession);
    setSelectedCourses(loaded);
    setAllowConflicts(loadAllowConflicts());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      saveSelectedCourses(selectedCourses);
    }
  }, [selectedCourses, mounted]);

  const handleToggleConflicts = useCallback((value: boolean) => {
    setAllowConflicts(value);
    saveAllowConflicts(value);
  }, []);

  const handleAddCourse = useCallback((courseCode: string, sectionNumber: number, subsessionId?: string) => {
    setSelectedCourses(prev => {
      const newSelected: SelectedCourse = { courseCode, sectionNumber, subsessionId };
      const withSubsession = autoAssignSubsession(newSelected);
      const existing = prev.findIndex(s => s.courseCode === courseCode);
      if (!allowConflicts) {
        const conflictCheck = checkNewCourseConflict(
          courses,
          prev,
          courseCode,
          sectionNumber,
          withSubsession.subsessionId,
          courseCode
        );

        if (conflictCheck.hasConflict) {
          showToast(`No se puede agregar porque hay un cruce de horario con: ${conflictCheck.conflictingCourseName}`, 'error');
          return prev;
        }
      }

      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = withSubsession;
        return updated;
      }
      return [...prev, withSubsession];
    });
  }, [showToast, allowConflicts]);

  const handleRemoveCourse = useCallback((courseCode: string) => {
    setSelectedCourses(prev => prev.filter(s => s.courseCode !== courseCode));
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

  const handleCapture = useCallback(async () => {
    if (!calendarRef.current || capturing) return;
    setCapturing(true);

    try {
      const blob = await toBlob(calendarRef.current, {
        backgroundColor: document.documentElement.classList.contains('dark') ? '#030712' : '#ffffff',
        pixelRatio: 2,
      });

      if (!blob) {
        showToast('Error al generar la imagen.', 'error');
        setCapturing(false);
        return;
      }

      // Try clipboard first
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        showToast('Horario copiado al portapapeles.', 'success');
      } else {
        // Fallback: download the image
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'horario-utec.png';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Imagen descargada (tu navegador no soporta copiar al portapapeles).', 'info');
      }
    } catch {
      showToast('Error al capturar el horario.', 'error');
    } finally {
      setCapturing(false);
    }
  }, [capturing, showToast]);

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
            <div className="hidden sm:block relative group">
              <button
                type="button"
                className="flex items-center justify-center w-6 h-6 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 rounded-full border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-800/60 transition-colors cursor-default"
              >
                ?
              </button>
              <div className="absolute right-0 top-full mt-2 w-64 p-3 text-xs text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                Sube tu PDF de Carga Hábil para filtrar y mostrar solo los cursos que debes llevar. Puedes remover el filtro con el botón <strong>&quot;Remover filtro Carga Hábil&quot;</strong> en la sección de búsqueda.
              </div>
            </div>
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
                onRemoveCourse={handleRemoveCourse}
                onHoverSection={setPreviewSection}
              />
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3 transition-colors duration-300">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs text-gray-600 dark:text-gray-300">Permitir cruces de horario</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={allowConflicts}
                  onClick={() => handleToggleConflicts(!allowConflicts)}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                    allowConflicts ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                      allowConflicts ? 'translate-x-[18px]' : 'translate-x-[3px]'
                    }`}
                  />
                </button>
              </label>
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
              />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 transition-colors duration-300">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Horario semanal</h2>
              {events.length > 0 && (
                <button
                  onClick={handleCapture}
                  disabled={capturing}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800/60 transition-colors border border-blue-200 dark:border-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {capturing ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Capturando...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-1M15 3h4a2 2 0 012 2v4m-6-3l6-2m-6 2l-2 6" />
                      </svg>
                      <span>Copiar imagen</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <WeeklyCalendar events={events} previewEvents={previewEvents} calendarRef={calendarRef} />
          </div>
        </div>
      </main>

      <footer className="max-w-[1400px] mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 dark:border-gray-800 transition-colors duration-300">
        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          <span>Hecho con por</span>
          <div className="flex items-center gap-3">
            <a 
              href="https://github.com/LuisMUtec" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-blue-500 transition-colors"
            >
              LuisMUtec
            </a>
            <span className="text-gray-300 dark:text-gray-700">|</span>
            <a 
              href="https://github.com/JoelxD12O" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-blue-500 transition-colors"
            >
              JoelxD12O
            </a>
          </div>
        </div>
        <div className="text-[10px] text-gray-300 dark:text-gray-600">
          Utec Horarios © 2026
        </div>
      </footer>

      <FeedbackButton />

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
