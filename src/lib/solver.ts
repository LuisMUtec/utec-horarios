import { Course, SelectedCourse, Session } from '@/types';
import { analyzeSection } from './subsession-utils';
import { DAYS, END_HOUR, START_HOUR, WEEK_A, WEEK_B } from './schedule-utils';

/**
 * Armado automático de horarios: dado un conjunto de cursos, elige la sección
 * (y subsesión) de cada uno minimizando las horas muertas entre clases.
 *
 * El alumno decide QUÉ cursos lleva; el solver sólo decide CÓMO. Elegir también
 * el subconjunto de cursos exigiría saber avance de malla y prerequisitos, que
 * la app no tiene.
 *
 * Representación: cada día son 15 slots de una hora (07:00–22:00), o sea un
 * entero de 15 bits, y un horario son 6 enteros. Detectar un cruce es un AND.
 * Toda la oferta cae en horas exactas, así que no se pierde resolución.
 *
 * Semana A y Semana B son semanas alternadas: dos clases en el mismo slot, una
 * en A y otra en B, NO se cruzan. Por eso hay dos planos de bits en vez de uno.
 * Una sesión de "Semana General" ocurre todas las semanas y ocupa ambos planos,
 * con lo cual choca contra A, contra B y contra General sin ningún caso especial.
 */

const N_DAYS = DAYS.length;
const N_SLOTS = END_HOUR - START_HOUR;

const DAY_INDEX: Record<string, number> = Object.fromEntries(
  DAYS.map((day, index) => [day, index])
);

/** Un plano semanal: un entero de bits de horas ocupadas por cada día. */
type WeekMask = number[];

/** Una elección posible para un curso: sección + subsesión, ya rasterizada. */
export interface ScheduleOption {
  courseCode: string;
  sectionNumber: number;
  subsessionId?: string;
  sessions: Session[];
  /** Horas ocupadas en las semanas A y B. Una sesión General está en ambas. */
  weekA: WeekMask;
  weekB: WeekMask;
}

export interface ScheduleCandidate {
  /** Listo para enchufar en setSelectedCourses / getCalendarEvents. */
  selection: SelectedCourse[];
  /**
   * Minutos de hueco entre la primera y la última clase de cada día,
   * promediados entre semana A y semana B. Sin umbral: a diferencia de
   * computeFreeBlocks, acá un hueco de 1 h también cuenta.
   */
  deadMinutes: number;
  /** Días de la semana con al menos una clase. */
  daysWithClass: number;
}

export interface SolveResult {
  /** Los mejores candidatos, de menos a más horas muertas. */
  candidates: ScheduleCandidate[];
  /**
   * Combinaciones sin cruces que se evaluaron enteras. NO es el total de
   * horarios posibles: la cota inferior descarta ramas completas sin recorrer
   * las combinaciones válidas que contienen. Sirve para distinguir "no hay
   * ninguno" (cero) de "hay varios", no para mostrarlo como cifra exacta.
   */
  evaluatedCount: number;
  /** false si la búsqueda se cortó por el tope de nodos y puede faltar el óptimo. */
  exhaustive: boolean;
  /**
   * Cuando no hay ninguna combinación viable, el primer par de cursos que se
   * cruza en todas sus secciones. Sin esto, la UI sólo puede decir "no hay
   * horario posible", que no le sirve a nadie. Queda undefined si la culpa no
   * es de ningún par (tres o más cursos que sólo son incompatibles juntos).
   */
  blockingPair?: { courseCodeA: string; courseCodeB: string };
}

export interface SolveOptions {
  /** Cuántos candidatos devolver. */
  topN?: number;
  /**
   * Tope de nodos explorados. Un horario normal se resuelve en milisegundos,
   * pero los cursos con más de 15 secciones pueden multiplicarse hasta cientos
   * de millones de combinaciones y colgar la pestaña. Al pasarse, devuelve el
   * mejor resultado hasta ese punto con exhaustive en false.
   */
  maxNodes?: number;
}

const DEFAULT_TOP_N = 5;
const DEFAULT_MAX_NODES = 2_000_000;
const MINUTES_PER_SLOT = 60;

function emptyMask(): WeekMask {
  return new Array<number>(N_DAYS).fill(0);
}

/** Marca las horas de una sesión sobre el plano. Ignora días u horas fuera de rango. */
function paintSession(mask: WeekMask, session: Session): void {
  const day = DAY_INDEX[session.day];
  if (day === undefined) return;
  const from = Number(session.startTime.slice(0, 2)) - START_HOUR;
  const to = Number(session.endTime.slice(0, 2)) - START_HOUR;
  for (let slot = Math.max(0, from); slot < Math.min(N_SLOTS, to); slot++) {
    mask[day] |= 1 << slot;
  }
}

/**
 * Todas las elecciones posibles para un curso.
 *
 * Replica la semántica de getFilteredSessions: sin subsesiones, la sección
 * entera; con subsesiones, las obligatorias más un grupo. Si las dos difieren,
 * el solver propondría horarios que el calendario dibuja de otra forma.
 */
export function buildCourseOptions(course: Course): ScheduleOption[] {
  const options: ScheduleOption[] = [];

  for (const section of course.sections) {
    const analysis = analyzeSection(section);
    const variants = analysis.subsessionGroups.length === 0
      ? [{ id: undefined, sessions: section.sessions }]
      : analysis.subsessionGroups.map(group => ({
          id: group.id,
          sessions: [...analysis.mandatorySessions, ...group.sessions],
        }));

    for (const variant of variants) {
      const weekA = emptyMask();
      const weekB = emptyMask();
      for (const session of variant.sessions) {
        if (session.frequency !== WEEK_B) paintSession(weekA, session);
        if (session.frequency !== WEEK_A) paintSession(weekB, session);
      }
      options.push({
        courseCode: course.code,
        sectionNumber: section.number,
        subsessionId: variant.id,
        sessions: variant.sessions,
        weekA,
        weekB,
      });
    }
  }

  return options;
}

function overlaps(a: WeekMask, b: WeekMask): boolean {
  for (let day = 0; day < N_DAYS; day++) {
    if ((a[day] & b[day]) !== 0) return true;
  }
  return false;
}

function conflicts(accA: WeekMask, accB: WeekMask, option: ScheduleOption): boolean {
  return overlaps(accA, option.weekA) || overlaps(accB, option.weekB);
}

function popcount(bits: number): number {
  let n = bits - ((bits >> 1) & 0x5555);
  n = (n & 0x3333) + ((n >> 2) & 0x3333);
  n = (n + (n >> 4)) & 0x0f0f;
  return (n + (n >> 8)) & 0x1f;
}

/** Horas de hueco de un plano: el rango primera-última clase menos lo ocupado. */
function deadSlots(mask: WeekMask): number {
  let total = 0;
  for (let day = 0; day < N_DAYS; day++) {
    const bits = mask[day];
    if (bits === 0) continue;
    const first = 31 - Math.clz32(bits & -bits);
    const last = 31 - Math.clz32(bits);
    total += last - first + 1 - popcount(bits);
  }
  return total;
}

/** Horas ocupadas de un plano. */
function busySlots(mask: WeekMask): number {
  let total = 0;
  for (let day = 0; day < N_DAYS; day++) total += popcount(mask[day]);
  return total;
}

/** Ancho primera-última clase de cada día, sumado. Sólo puede crecer al agregar cursos. */
function spanSlots(mask: WeekMask): number {
  let total = 0;
  for (let day = 0; day < N_DAYS; day++) {
    const bits = mask[day];
    if (bits === 0) continue;
    const first = 31 - Math.clz32(bits & -bits);
    const last = 31 - Math.clz32(bits);
    total += last - first + 1;
  }
  return total;
}

function daysWithClass(accA: WeekMask, accB: WeekMask): number {
  let total = 0;
  for (let day = 0; day < N_DAYS; day++) {
    if ((accA[day] | accB[day]) !== 0) total++;
  }
  return total;
}

/**
 * Candidato con su clave de desempate ya calculada.
 *
 * La clave se computa una sola vez por candidato y no dentro del comparador:
 * armarla cuesta un map + sort + join, y hacerlo en cada comparación degradaba
 * la búsqueda a cuadrática en cuanto topN dejaba de ser un puñado.
 */
interface RankedCandidate extends ScheduleCandidate {
  key: string;
}

/**
 * Clave estable de una combinación, para desempatar de forma determinista.
 * Sin esto, dos ejecuciones idénticas podrían devolver distintos empates según
 * el orden de enumeración, y hay muchísimos empates en 0 horas muertas.
 */
function candidateKey(selection: SelectedCourse[]): string {
  return selection
    .map(s => `${s.courseCode}-${s.sectionNumber}-${s.subsessionId ?? ''}`)
    .sort()
    .join('|');
}

function compareCandidates(a: RankedCandidate, b: RankedCandidate): number {
  if (a.deadMinutes !== b.deadMinutes) return a.deadMinutes - b.deadMinutes;
  // Con la misma cantidad de horas muertas, concentrar las clases en menos días
  // es estrictamente mejor: son menos viajes al campus.
  if (a.daysWithClass !== b.daysWithClass) return a.daysWithClass - b.daysWithClass;
  return a.key.localeCompare(b.key);
}

/**
 * Busca el par de cursos que se cruza en todas sus combinaciones de secciones.
 * Sólo se llama cuando no hubo ninguna solución, así que el costo cuadrático da
 * igual: sin solución, el backtracking ya terminó rápido.
 */
function findBlockingPair(groups: ScheduleOption[][]): SolveResult['blockingPair'] {
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const compatible = groups[i].some(a =>
        groups[j].some(b => !(overlaps(a.weekA, b.weekA) || overlaps(a.weekB, b.weekB)))
      );
      if (!compatible) {
        return {
          courseCodeA: groups[i][0].courseCode,
          courseCodeB: groups[j][0].courseCode,
        };
      }
    }
  }
  return undefined;
}

/**
 * Elige sección y subsesión de cada curso minimizando las horas muertas.
 *
 * Enumera exhaustivamente con dos podas: el cruce de horarios corta el subárbol
 * de entrada, y una cota inferior descarta ramas que ya no pueden mejorar al
 * peor candidato del top-N. La cota se apoya en que el ancho primera-última
 * clase sólo crece al agregar cursos, mientras que las horas de clase que
 * faltan por sumar están acotadas por arriba; la resta de ambas nunca supera
 * las horas muertas finales.
 *
 * Los cursos que no existen en el catálogo se ignoran en silencio: courses.json
 * se regenera cada período y una selección vieja puede referirse a un código
 * que ya no se dicta.
 */
export function solveSchedule(
  courses: Course[],
  courseCodes: string[],
  { topN = DEFAULT_TOP_N, maxNodes = DEFAULT_MAX_NODES }: SolveOptions = {}
): SolveResult {
  const byCode = new Map(courses.map(course => [course.code, course]));
  const groups: ScheduleOption[][] = [];

  for (const code of courseCodes) {
    const course = byCode.get(code);
    if (!course) continue;
    const options = buildCourseOptions(course);
    // Un curso sin secciones no restringe nada, pero dejaría el producto en
    // cero y no habría ninguna solución.
    if (options.length > 0) groups.push(options);
  }

  if (groups.length === 0) {
    return { candidates: [], evaluatedCount: 0, exhaustive: true };
  }

  // Los cursos con menos alternativas primero: fuerzan el cruce antes y podan
  // más arriba en el árbol.
  groups.sort((a, b) => a.length - b.length);

  // Máximo de horas de clase que cada curso pendiente puede aún aportar, por
  // plano. Es el término que afloja la cota inferior conforme se profundiza.
  const suffixMaxA = new Array<number>(groups.length + 1).fill(0);
  const suffixMaxB = new Array<number>(groups.length + 1).fill(0);
  for (let i = groups.length - 1; i >= 0; i--) {
    let maxA = 0;
    let maxB = 0;
    for (const option of groups[i]) {
      maxA = Math.max(maxA, busySlots(option.weekA));
      maxB = Math.max(maxB, busySlots(option.weekB));
    }
    suffixMaxA[i] = suffixMaxA[i + 1] + maxA;
    suffixMaxB[i] = suffixMaxB[i + 1] + maxB;
  }

  const accA = emptyMask();
  const accB = emptyMask();
  const chosen: ScheduleOption[] = [];
  const best: RankedCandidate[] = [];

  let evaluatedCount = 0;
  let nodes = 0;
  let exhaustive = true;

  function record(): void {
    evaluatedCount++;
    const selection = chosen.map(option => ({
      courseCode: option.courseCode,
      sectionNumber: option.sectionNumber,
      subsessionId: option.subsessionId,
    }));
    const candidate: RankedCandidate = {
      selection,
      deadMinutes: ((deadSlots(accA) + deadSlots(accB)) * MINUTES_PER_SLOT) / 2,
      daysWithClass: daysWithClass(accA, accB),
      key: candidateKey(selection),
    };
    // El top está lleno y el candidato no le gana al peor: se descarta sin tocar
    // el array. Es el camino de la abrumadora mayoría de las soluciones.
    if (best.length >= topN && compareCandidates(candidate, best[best.length - 1]) >= 0) {
      return;
    }
    // Inserción ordenada por búsqueda binaria. Reordenar el array entero en cada
    // solución encontrada costaba más que la búsqueda misma.
    let low = 0;
    let high = best.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (compareCandidates(best[mid], candidate) <= 0) low = mid + 1;
      else high = mid;
    }
    best.splice(low, 0, candidate);
    if (best.length > topN) best.pop();
  }

  function search(depth: number): void {
    // Marcar acá y no sólo en el bucle: si el tope se alcanza procesando la
    // última opción de cada nivel, ningún for enclosing vuelve a evaluar su
    // guarda y la búsqueda se daría por completa sin serlo.
    if (nodes >= maxNodes) {
      exhaustive = false;
      return;
    }

    if (depth === groups.length) {
      record();
      return;
    }

    // Cota inferior de las horas muertas que puede alcanzar esta rama. Sólo
    // sirve con el top-N lleno, que es cuando hay un umbral contra el cual medir.
    if (best.length === topN) {
      const lowerA = spanSlots(accA) - busySlots(accA) - suffixMaxA[depth];
      const lowerB = spanSlots(accB) - busySlots(accB) - suffixMaxB[depth];
      const lowerMinutes = (Math.max(0, lowerA) + Math.max(0, lowerB)) * MINUTES_PER_SLOT / 2;
      if (lowerMinutes > best[best.length - 1].deadMinutes) return;
    }

    for (const option of groups[depth]) {
      if (nodes >= maxNodes) {
        exhaustive = false;
        return;
      }
      nodes++;
      if (conflicts(accA, accB, option)) continue;

      for (let day = 0; day < N_DAYS; day++) {
        accA[day] |= option.weekA[day];
        accB[day] |= option.weekB[day];
      }
      chosen.push(option);

      search(depth + 1);

      chosen.pop();
      for (let day = 0; day < N_DAYS; day++) {
        accA[day] &= ~option.weekA[day];
        accB[day] &= ~option.weekB[day];
      }
    }
  }

  search(0);

  return {
    // La clave de desempate es un detalle interno: no viaja en el resultado.
    candidates: best.map(({ selection, deadMinutes, daysWithClass: days }) => ({
      selection,
      deadMinutes,
      daysWithClass: days,
    })),
    evaluatedCount,
    exhaustive,
    blockingPair: evaluatedCount === 0 ? findBlockingPair(groups) : undefined,
  };
}
