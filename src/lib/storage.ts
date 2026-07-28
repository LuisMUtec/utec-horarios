import { SelectedCourse } from '@/types';

const STORAGE_KEY = 'utec-horarios-selected';
const ALLOW_CONFLICTS_KEY = 'utec-horarios-allow-conflicts';

/**
 * Stores observables sobre localStorage, pensados para useSyncExternalStore.
 *
 * getSnapshot debe devolver siempre la MISMA referencia mientras el valor no
 * cambie, o React entra en un loop infinito ("The result of getSnapshot should
 * be cached"). Por eso el valor vive cacheado a nivel de módulo: se lee de
 * localStorage una sola vez (lazy) y la referencia solo se reemplaza al escribir.
 */

type Updater<T> = T | ((prev: T) => T);

function applyUpdate<T>(update: Updater<T>, prev: T): T {
  return typeof update === 'function' ? (update as (p: T) => T)(prev) : update;
}

// --- Cursos seleccionados ---

const EMPTY_COURSES: SelectedCourse[] = [];

let coursesCache: SelectedCourse[] | null = null;
const coursesListeners = new Set<() => void>();

function readCourses(): SelectedCourse[] {
  if (typeof window === 'undefined') return EMPTY_COURSES;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : EMPTY_COURSES;
  } catch {
    return EMPTY_COURSES;
  }
}

export function subscribeSelectedCourses(listener: () => void): () => void {
  coursesListeners.add(listener);
  return () => coursesListeners.delete(listener);
}

export function getSelectedCoursesSnapshot(): SelectedCourse[] {
  coursesCache ??= readCourses();
  return coursesCache;
}

export function getSelectedCoursesServerSnapshot(): SelectedCourse[] {
  return EMPTY_COURSES;
}

export function setSelectedCourses(update: Updater<SelectedCourse[]>): void {
  const next = applyUpdate(update, getSelectedCoursesSnapshot());
  if (next === coursesCache) return;
  coursesCache = next;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }
  coursesListeners.forEach((listener) => listener());
}

// --- Permitir cruces de horario ---

let allowConflictsCache: boolean | null = null;
const allowConflictsListeners = new Set<() => void>();

function readAllowConflicts(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(ALLOW_CONFLICTS_KEY) === 'true';
  } catch {
    return false;
  }
}

export function subscribeAllowConflicts(listener: () => void): () => void {
  allowConflictsListeners.add(listener);
  return () => allowConflictsListeners.delete(listener);
}

export function getAllowConflictsSnapshot(): boolean {
  allowConflictsCache ??= readAllowConflicts();
  return allowConflictsCache;
}

export function getAllowConflictsServerSnapshot(): boolean {
  return false;
}

export function setAllowConflicts(update: Updater<boolean>): void {
  const next = applyUpdate(update, getAllowConflictsSnapshot());
  if (next === allowConflictsCache) return;
  allowConflictsCache = next;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(ALLOW_CONFLICTS_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }
  allowConflictsListeners.forEach((listener) => listener());
}
