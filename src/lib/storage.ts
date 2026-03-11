import { SelectedCourse } from '@/types';

const STORAGE_KEY = 'utec-horarios-selected';

export function loadSelectedCourses(): SelectedCourse[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveSelectedCourses(courses: SelectedCourse[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
  } catch {
    // Ignore storage errors
  }
}
