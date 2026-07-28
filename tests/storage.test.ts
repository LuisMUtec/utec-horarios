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
const SHOW_GAPS_KEY = 'utec-horarios-show-gaps';

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

/**
 * Stub del <html> para los tests de showGaps, que además de React sincroniza una
 * clase en el DOM. El entorno de vitest es 'node': sin esto no hay document.
 */
function installDocument(clasesIniciales: string[] = []): Set<string> {
  const clases = new Set(clasesIniciales);
  vi.stubGlobal('document', {
    documentElement: {
      classList: {
        toggle: (nombre: string, forzar: boolean) => {
          if (forzar) clases.add(nombre);
          else clases.delete(nombre);
        },
      },
    },
  });
  return clases;
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

/**
 * showGaps es la única preferencia con default true, así que su lectura no puede
 * copiar el `=== 'true'` de allowConflicts: cualquier ausencia o basura en la
 * clave tiene que caer en true, y solo un 'false' explícito la apaga. El server
 * snapshot vale true por lo mismo (FR-022 del spec).
 */
describe('showGaps — lectura', () => {
  it('por defecto es true', async () => {
    const s = await freshStore();
    expect(s.getShowGapsSnapshot()).toBe(true);
  });

  it('lee false de localStorage', async () => {
    const s = await freshStore({ [SHOW_GAPS_KEY]: 'false' });
    expect(s.getShowGapsSnapshot()).toBe(false);
  });

  it('lee true de localStorage', async () => {
    const s = await freshStore({ [SHOW_GAPS_KEY]: 'true' });
    expect(s.getShowGapsSnapshot()).toBe(true);
  });

  it.each(['basura', '', '0', 'null', 'False'])(
    'un valor corrupto (%j) cae en el default true',
    async valor => {
      const s = await freshStore({ [SHOW_GAPS_KEY]: valor });
      expect(s.getShowGapsSnapshot()).toBe(true);
    }
  );

  it('getSnapshot devuelve la misma referencia entre llamadas', async () => {
    const s = await freshStore({ [SHOW_GAPS_KEY]: 'false' });
    expect(s.getShowGapsSnapshot()).toBe(s.getShowGapsSnapshot());
  });

  it('getServerSnapshot es true, no false como las demás preferencias', async () => {
    const s = await freshStore({ [SHOW_GAPS_KEY]: 'false' });
    expect(s.getShowGapsServerSnapshot()).toBe(true);
    expect(s.getAllowConflictsServerSnapshot()).toBe(false);
  });

  it('sin window (SSR) devuelve el default true', async () => {
    installLocalStorage();
    mem.set(SHOW_GAPS_KEY, 'false');
    vi.stubGlobal('window', undefined);
    vi.resetModules();
    const s: Storage = await import('@/lib/storage');
    expect(s.getShowGapsSnapshot()).toBe(true);
  });
});

describe('showGaps — escritura', () => {
  it('persiste con el mismo formato que espera la lectura', async () => {
    // Se escribe con JSON.stringify y se lee comparando contra 'false':
    // si alguien cambia uno de los dos lados, el toggle deja de persistir.
    const s = await freshStore();
    expect(s.setShowGaps(false)).toBe(true);
    expect(mem.get(SHOW_GAPS_KEY)).toBe('false');

    const recargado = await freshStore({ [SHOW_GAPS_KEY]: mem.get(SHOW_GAPS_KEY)! });
    expect(recargado.getShowGapsSnapshot()).toBe(false);
  });

  it('volver a activarlo persiste true y sobrevive a la recarga', async () => {
    const s = await freshStore({ [SHOW_GAPS_KEY]: 'false' });
    s.setShowGaps(true);
    expect(mem.get(SHOW_GAPS_KEY)).toBe('true');

    const recargado = await freshStore({ [SHOW_GAPS_KEY]: mem.get(SHOW_GAPS_KEY)! });
    expect(recargado.getShowGapsSnapshot()).toBe(true);
  });

  it('acepta la forma updater con el valor previo', async () => {
    const s = await freshStore();
    s.setShowGaps(prev => !prev);
    expect(s.getShowGapsSnapshot()).toBe(false);
  });

  it('notifica al cambiar y no en un no-op', async () => {
    const s = await freshStore();
    const listener = vi.fn();
    s.subscribeShowGaps(listener);
    s.setShowGaps(false);
    expect(listener).toHaveBeenCalledOnce();
    s.setShowGaps(false);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('deja de notificar tras desuscribirse', async () => {
    const s = await freshStore();
    const listener = vi.fn();
    const unsub = s.subscribeShowGaps(listener);
    s.setShowGaps(false);
    unsub();
    s.setShowGaps(true);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('tiene listeners independientes de las otras preferencias', async () => {
    const s = await freshStore();
    const huecos = vi.fn();
    const cruces = vi.fn();
    s.subscribeShowGaps(huecos);
    s.subscribeAllowConflicts(cruces);
    s.setShowGaps(false);
    expect(huecos).toHaveBeenCalledOnce();
    expect(cruces).not.toHaveBeenCalled();
  });
});

describe('showGaps — fallo de persistencia', () => {
  it('devuelve false cuando localStorage rechaza la escritura', async () => {
    const s = await freshStore();
    failWrites = true;
    expect(s.setShowGaps(false)).toBe(false);
  });

  it('igual actualiza el estado en memoria para no romper la sesión', async () => {
    const s = await freshStore();
    const listener = vi.fn();
    s.subscribeShowGaps(listener);
    failWrites = true;
    s.setShowGaps(false);
    expect(s.getShowGapsSnapshot()).toBe(false);
    expect(listener).toHaveBeenCalledOnce();
  });
});

/**
 * La clase del <html> es lo que evita el parpadeo (FR-024): el script bloqueante
 * de layout.tsx la pone antes del primer paint y globals.css oculta los bloques.
 * setShowGaps debe mantenerla en sincronía, o al apagar el toggle en caliente el
 * CSS y React quedarían en desacuerdo hasta la siguiente recarga.
 */
describe('showGaps — sincronización con el <html>', () => {
  it('apagarlo marca la clase hide-gaps', async () => {
    const s = await freshStore();
    const clases = installDocument();
    s.setShowGaps(false);
    expect(clases.has(s.HIDE_GAPS_CLASS)).toBe(true);
  });

  it('encenderlo la quita', async () => {
    const s = await freshStore({ [SHOW_GAPS_KEY]: 'false' });
    // El script bloqueante ya la había puesto en esta carga.
    const clases = installDocument(['hide-gaps']);
    s.setShowGaps(true);
    expect(clases.has(s.HIDE_GAPS_CLASS)).toBe(false);
  });

  it('la clase coincide con el literal que usa el script bloqueante', async () => {
    const s = await freshStore();
    expect(s.HIDE_GAPS_CLASS).toBe('hide-gaps');
  });

  it('la clave coincide con la que lee el script bloqueante', async () => {
    // El script de layout.tsx la tiene escrita a mano. Si el store la renombra,
    // deja de encontrar la preferencia y vuelve el parpadeo: nada más falla.
    const s = await freshStore();
    expect(s.SHOW_GAPS_KEY).toBe('utec-horarios-show-gaps');
  });

  it('sin document (SSR) no revienta', async () => {
    const s = await freshStore();
    expect(() => s.setShowGaps(false)).not.toThrow();
  });
});
