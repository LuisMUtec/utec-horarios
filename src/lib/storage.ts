import { SelectedCourse } from '@/types';

const STORAGE_KEY = 'utec-horarios-selected';
const ALLOW_CONFLICTS_KEY = 'utec-horarios-allow-conflicts';

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

export function loadAllowConflicts(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(ALLOW_CONFLICTS_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveAllowConflicts(allow: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ALLOW_CONFLICTS_KEY, JSON.stringify(allow));
  } catch {
    // Ignore storage errors
  }
}
