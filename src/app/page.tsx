'use client';

import { useState, useEffect, useCallback } from 'react';
import coursesData from '@/data/courses.json';
import { Course, SelectedCourse } from '@/types';
import { getCalendarEvents, getPreviewEvents } from '@/lib/schedule-utils';
import { loadSelectedCourses, saveSelectedCourses } from '@/lib/storage';
import { analyzeSection } from '@/lib/subsession-utils';
import CourseSearch from '@/components/CourseSearch';
import SelectedCoursesList from '@/components/SelectedCoursesList';
import WeeklyCalendar from '@/components/WeeklyCalendar';

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
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = withSubsession;
        return updated;
      }
      return [...prev, withSubsession];
    });
  }, []);

  const handleRemoveCourse = useCallback((courseCode: string) => {
    setSelectedCourses(prev => prev.filter(s => s.courseCode !== courseCode));
  }, []);

  const handleChangeSection = useCallback((courseCode: string, newSection: number) => {
    setSelectedCourses(prev =>
      prev.map(s => {
        if (s.courseCode !== courseCode) return s;
        // Reset subsessionId and auto-assign for new section
        return autoAssignSubsession({ courseCode, sectionNumber: newSection });
      })
    );
  }, []);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">UTEC Horarios</h1>
            <p className="text-xs text-gray-500">Periodo 2026-1</p>
          </div>
          <div className="text-xs text-gray-400">
            {courses.length} cursos disponibles
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-4">
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Buscar cursos</h2>
              <CourseSearch
                courses={courses}
                selectedCourses={selectedCourses}
                onAddCourse={handleAddCourse}
                onHoverSection={setPreviewSection}
              />
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">
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

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Horario semanal</h2>
            <WeeklyCalendar events={events} previewEvents={previewEvents} />
          </div>
        </div>
      </main>
    </div>
  );
}
