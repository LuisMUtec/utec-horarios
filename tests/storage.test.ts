import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SelectedCourse } from '@/types';

/**
 * Tests del store observable sobre localStorage.
 *
 * El contrato crítico es la estabilidad referencial de getSnapshot: si devuelve
 * una referencia nueva en cada llamada, useSyncExternalStore entra en un loop
 * infinito de renders. Los tests marcados abajo lo cubren.
 *
 * El store cachea a nivel de módulo, así que cada test necesita un módulo
 * fresco: de ahí el resetModules + import dinámico.
 */

const STORAGE_KEY = 'utec-horarios-selected';
const ALLOW_CONFLICTS_KEY = 'utec-horarios-allow-conflicts';

type Storage = typeof import('@/lib/storage');

let mem: Map<string, string>;
let failWrites: boolean;

function installLocalStorage() {
  mem = new Map();
  failWrites = false;
  const stub = {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (failWrites) throw new DOMException('QuotaExceededError');
      mem.set(k, String(v));
    },
    removeItem: (k: string) => void mem.delete(k),
  };
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('localStorage', stub);
}

/** Importa el store recién inicializado, opcionalmente con datos ya persistidos. */
async function freshStore(seed?: Record<string, string>): Promise<Storage> {
  installLocalStorage();
  if (seed) for (const [k, v] of Object.entries(seed)) mem.set(k, v);
  vi.resetModules();
  return import('@/lib/storage');
}

const CURSO_A: SelectedCourse = { courseCode: 'CS2023', sectionNumber: 1 };
const CURSO_B: SelectedCourse = { courseCode: 'MA1002', sectionNumber: 3 };

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('selectedCourses — lectura', () => {
  it('lee lo persistido en localStorage', async () => {
    const s = await freshStore({ [STORAGE_KEY]: JSON.stringify([CURSO_A]) });
    expect(s.getSelectedCoursesSnapshot()).toEqual([CURSO_A]);
  });

  it('sin datos devuelve lista vacía', async () => {
    const s = await freshStore();
    expect(s.getSelectedCoursesSnapshot()).toEqual([]);
  });

  // CONTRATO CRÍTICO: sin esto, useSyncExternalStore hace loop infinito.
  it('getSnapshot devuelve la misma referencia entre llamadas', async () => {
    const s = await freshStore({ [STORAGE_KEY]: JSON.stringify([CURSO_A]) });
    expect(s.getSelectedCoursesSnapshot()).toBe(s.getSelectedCoursesSnapshot());
  });

  it('getServerSnapshot devuelve una referencia estable y vacía', async () => {
    const s = await freshStore({ [STORAGE_KEY]: JSON.stringify([CURSO_A]) });
    expect(s.getSelectedCoursesServerSnapshot()).toBe(s.getSelectedCoursesServerSnapshot());
    expect(s.getSelectedCoursesServerSnapshot()).toEqual([]);
  });

  it('sin window (SSR) devuelve vacío aunque haya datos', async () => {
    installLocalStorage();
    mem.set(STORAGE_KEY, JSON.stringify([CURSO_A]));
    vi.stubGlobal('window', undefined);
    vi.resetModules();
    const s: Storage = await import('@/lib/storage');
    expect(s.getSelectedCoursesSnapshot()).toEqual([]);
  });
});

describe('selectedCourses — datos corruptos', () => {
  // Sin el guard Array.isArray, el .map() de page.tsx revienta con estos valores.
  it.each([
    ['JSON inválido', '{no es json'],
    ['un objeto', '{"a":1}'],
    ['un string', '"hola"'],
    ['null literal', 'null'],
    ['un número', '42'],
  ])('con %s arranca de cero en vez de romper', async (_caso, valor) => {
    const s = await freshStore({ [STORAGE_KEY]: valor });
    const snapshot = s.getSelectedCoursesSnapshot();
    expect(Array.isArray(snapshot)).toBe(true);
    expect(snapshot).toEqual([]);
    // Lo que importa: page.tsx hace .map() sobre esto sin romper.
    expect(() => snapshot.map(c => c.courseCode)).not.toThrow();
  });
});

describe('selectedCourses — escritura', () => {
  it('persiste y notifica a los suscriptores', async () => {
    const s = await freshStore();
    const listener = vi.fn();
    s.subscribeSelectedCourses(listener);

    expect(s.setSelectedCourses([CURSO_A])).toBe(true);

    expect(listener).toHaveBeenCalledOnce();
    expect(s.getSelectedCoursesSnapshot()).toEqual([CURSO_A]);
    expect(JSON.parse(mem.get(STORAGE_KEY)!)).toEqual([CURSO_A]);
  });

  it('acepta la forma updater con el valor previo', async () => {
    const s = await freshStore({ [STORAGE_KEY]: JSON.stringify([CURSO_A]) });
    s.setSelectedCourses(prev => [...prev, CURSO_B]);
    expect(s.getSelectedCoursesSnapshot()).toEqual([CURSO_A, CURSO_B]);
  });

  it('la referencia sigue siendo estable después de escribir', async () => {
    const s = await freshStore();
    s.setSelectedCourses([CURSO_A]);
    expect(s.getSelectedCoursesSnapshot()).toBe(s.getSelectedCoursesSnapshot());
  });

  it('devolver la misma referencia no notifica ni escribe', async () => {
    const s = await freshStore({ [STORAGE_KEY]: JSON.stringify([CURSO_A]) });
    const listener = vi.fn();
    s.subscribeSelectedCourses(listener);
    s.setSelectedCourses(prev => prev);
    expect(listener).not.toHaveBeenCalled();
  });

  it('deja de notificar tras desuscribirse', async () => {
    const s = await freshStore();
    const listener = vi.fn();
    const unsub = s.subscribeSelectedCourses(listener);
    s.setSelectedCourses([CURSO_A]);
    unsub();
    s.setSelectedCourses([CURSO_B]);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('vaciar la lista persiste', async () => {
    const s = await freshStore({ [STORAGE_KEY]: JSON.stringify([CURSO_A]) });
    s.setSelectedCourses([]);
    expect(JSON.parse(mem.get(STORAGE_KEY)!)).toEqual([]);
  });

  it('soporta varios suscriptores', async () => {
    const s = await freshStore();
    const a = vi.fn();
    const b = vi.fn();
    s.subscribeSelectedCourses(a);
    s.subscribeSelectedCourses(b);
    s.setSelectedCourses([CURSO_A]);
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });
});

describe('selectedCourses — fallo de persistencia', () => {
  // Safari en modo privado tira en cada setItem. Antes esto se tragaba en
  // silencio: la UI mostraba el curso agregado y al recargar no estaba.
  it('devuelve false cuando localStorage rechaza la escritura', async () => {
    const s = await freshStore();
    failWrites = true;
    expect(s.setSelectedCourses([CURSO_A])).toBe(false);
  });

  it('igual actualiza el estado en memoria para no romper la sesión', async () => {
    const s = await freshStore();
    const listener = vi.fn();
    s.subscribeSelectedCourses(listener);
    failWrites = true;
    s.setSelectedCourses([CURSO_A]);
    expect(s.getSelectedCoursesSnapshot()).toEqual([CURSO_A]);
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe('allowConflicts', () => {
  it('lee true de localStorage', async () => {
    const s = await freshStore({ [ALLOW_CONFLICTS_KEY]: 'true' });
    expect(s.getAllowConflictsSnapshot()).toBe(true);
  });

  it('por defecto es false', async () => {
    const s = await freshStore();
    expect(s.getAllowConflictsSnapshot()).toBe(false);
  });

  it('cualquier valor que no sea "true" es false', async () => {
    const s = await freshStore({ [ALLOW_CONFLICTS_KEY]: 'basura' });
    expect(s.getAllowConflictsSnapshot()).toBe(false);
  });

  it('persiste con el mismo formato que espera la lectura', async () => {
    // Se escribe con JSON.stringify y se lee comparando contra 'true':
    // si alguien cambia uno de los dos lados, el toggle deja de persistir.
    const s = await freshStore();
    s.setAllowConflicts(true);
    expect(mem.get(ALLOW_CONFLICTS_KEY)).toBe('true');

    const recargado = await freshStore({ [ALLOW_CONFLICTS_KEY]: mem.get(ALLOW_CONFLICTS_KEY)! });
    expect(recargado.getAllowConflictsSnapshot()).toBe(true);
  });

  it('notifica al cambiar y no en un no-op', async () => {
    const s = await freshStore();
    const listener = vi.fn();
    s.subscribeAllowConflicts(listener);
    s.setAllowConflicts(true);
    expect(listener).toHaveBeenCalledOnce();
    s.setAllowConflicts(true);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('devuelve false si no pudo persistir', async () => {
    const s = await freshStore();
    failWrites = true;
    expect(s.setAllowConflicts(true)).toBe(false);
  });

  it('tiene listeners independientes de selectedCourses', async () => {
    const s = await freshStore();
    const cursos = vi.fn();
    const cruces = vi.fn();
    s.subscribeSelectedCourses(cursos);
    s.subscribeAllowConflicts(cruces);
    s.setAllowConflicts(true);
    expect(cruces).toHaveBeenCalledOnce();
    expect(cursos).not.toHaveBeenCalled();
  });
});
