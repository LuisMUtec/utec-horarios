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

/** Escribe en localStorage. Devuelve false si falló (Safari privado, cuota llena). */
function writeKey(key: string, value: unknown): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// --- Cursos seleccionados ---

const EMPTY_COURSES: SelectedCourse[] = [];

let coursesCache: SelectedCourse[] | null = null;
const coursesListeners = new Set<() => void>();

function readCourses(): SelectedCourse[] {
  if (typeof window === 'undefined') return EMPTY_COURSES;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return EMPTY_COURSES;
    const parsed = JSON.parse(data);
    // JSON válido pero con la forma equivocada (objeto, string, null) haría
    // reventar el .map() de page.tsx. Ante datos corruptos, arrancar de cero.
    return Array.isArray(parsed) ? parsed : EMPTY_COURSES;
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

/** Devuelve false si no se pudo persistir (Safari privado, cuota llena). */
export function setSelectedCourses(update: Updater<SelectedCourse[]>): boolean {
  const next = applyUpdate(update, getSelectedCoursesSnapshot());
  if (next === coursesCache) return true;
  coursesCache = next;
  const persisted = writeKey(STORAGE_KEY, next);
  coursesListeners.forEach((listener) => listener());
  return persisted;
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

/** Devuelve false si no se pudo persistir (Safari privado, cuota llena). */
export function setAllowConflicts(update: Updater<boolean>): boolean {
  const next = applyUpdate(update, getAllowConflictsSnapshot());
  if (next === allowConflictsCache) return true;
  allowConflictsCache = next;
  const persisted = writeKey(ALLOW_CONFLICTS_KEY, next);
  allowConflictsListeners.forEach((listener) => listener());
  return persisted;
}
