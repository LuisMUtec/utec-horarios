// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import SectionSelector from '@/components/SectionSelector';
import { fetchCourseSummaries, publishReview } from '@/lib/api-client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import type { Course, Session } from '@/types';
import type { OwnReview, TeacherSummary } from '@/types/reviews';

vi.mock('@/lib/api-client', () => ({
  fetchCourseSummaries: vi.fn(),
  fetchPairReviews: vi.fn(),
  publishReview: vi.fn(),
}));
vi.mock('@/lib/supabase/config', () => ({ isSupabaseConfigured: vi.fn(() => true) }));

const { fetchPairReviews } = await import('@/lib/api-client');

const summariesMock = vi.mocked(fetchCourseSummaries);
const pairMock = vi.mocked(fetchPairReviews);
const publishMock = vi.mocked(publishReview);
const configuredMock = vi.mocked(isSupabaseConfigured);

afterEach(cleanup);

beforeEach(() => {
  summariesMock.mockReset().mockResolvedValue([]);
  pairMock.mockReset().mockResolvedValue({
    kind: 'ok',
    reviews: { courseTeacherId: 'par-1', comments: [], own: null },
  });
  publishMock.mockReset();
  configuredMock.mockReset().mockReturnValue(true);
});

const TEACHER = 'Ojeda Rios, Brenner Humberto';

const session = (overrides: Partial<Session> = {}): Session => ({
  type: 'TEORÍA 1',
  modality: 'Presencial',
  day: 'Lun',
  startTime: '09:00',
  endTime: '11:00',
  frequency: 'Semana General',
  location: 'UTEC-BA A904',
  capacity: 45,
  enrolled: 0,
  professor: TEACHER,
  email: 'bojeda@utec.edu.pe',
  ...overrides,
});

const course: Course = {
  code: 'CS2023',
  name: 'Algoritmos y Estructuras de Datos',
  sections: [{ number: 1, sessions: [session()] }],
};

const summary: TeacherSummary = {
  courseTeacherId: 'par-1',
  courseCode: 'CS2023',
  teacherEmail: 'bojeda@utec.edu.pe',
  teacherName: TEACHER,
  averageRating: 4.3,
  ratingCount: 7,
  commentCount: 2,
  recommendPercentage: 86,
};

const ownReview: OwnReview = {
  id: 'r-9',
  rating: 4,
  recommends: true,
  comment: null,
  publishedAt: '2026-07-29T15:04:05Z',
  commentPublishedAt: null,
  commentEditedAt: null,
};

function mount(withCourse: Course = course) {
  return render(
    <SectionSelector
      course={withCourse}
      onSelectSection={vi.fn()}
      onRemoveCourse={vi.fn()}
      onHoverSection={vi.fn()}
    />
  );
}

describe('SectionSelector — resúmenes', () => {
  // D1: un pedido por curso al desplegarlo, no uno por docente.
  it('pide los resúmenes del curso una sola vez', async () => {
    summariesMock.mockResolvedValue([summary]);

    mount();

    await screen.findByRole('button', { name: `Puntuar a ${TEACHER}` });
    expect(summariesMock).toHaveBeenCalledTimes(1);
    expect(summariesMock).toHaveBeenCalledWith('CS2023');
  });

  // El texto equivalente es el que dice el resumen entero: en pantalla son
  // fragmentos sueltos, y por eso cada dato aparece dos veces en el DOM.
  it('muestra el resumen del docente', async () => {
    summariesMock.mockResolvedValue([summary]);

    mount();

    expect(
      await screen.findByText(`${TEACHER}: 4.3 de 5 estrellas, 7 puntuaciones, 86% lo recomienda.`)
    ).toBeDefined();
    expect(screen.getByText('4.3')).toBeDefined();
  });

  // T037: sin Supabase la sección se ve como antes de las reseñas.
  it('sin Supabase no pide nada y solo imprime el nombre', () => {
    configuredMock.mockReturnValue(false);

    mount();

    expect(summariesMock).not.toHaveBeenCalled();
    expect(screen.getByText(TEACHER)).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Puntuar/ })).toBeNull();
  });

  // FR-054: sin correo no hay a quién evaluar.
  it('una sesión sin correo no ofrece puntuar', async () => {
    mount({
      ...course,
      sections: [{ number: 1, sessions: [session({ email: '', professor: '' })] }],
    });

    // Dos veces: el chip visible y el texto equivalente.
    expect(await screen.findAllByText(/Docente por asignar/)).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /^Puntuar/ })).toBeNull();
  });
});

describe('SectionSelector — el diálogo', () => {
  it('el botón abre el modal con el docente en el título', async () => {
    summariesMock.mockResolvedValue([summary]);
    mount();

    fireEvent.click(await screen.findByRole('button', { name: `Puntuar a ${TEACHER}` }));

    expect(await screen.findByRole('dialog', { name: TEACHER })).toBeDefined();
    expect(pairMock).toHaveBeenCalledWith('CS2023', 'bojeda@utec.edu.pe');
  });

  it('se cierra sin publicar y no avisa nada', async () => {
    mount();

    fireEvent.click(await screen.findByRole('button', { name: `Puntuar a ${TEACHER}` }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(/ya cuenta en el promedio/)).toBeNull();
  });
});

describe('SectionSelector — publicar', () => {
  async function publish() {
    fireEvent.click(await screen.findByRole('button', { name: `Puntuar a ${TEACHER}` }));
    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(screen.getByRole('radio', { name: '4 estrellas' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Sí' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
  }

  // El diálogo se va y la confirmación se queda: es momentánea, pero tiene que
  // sobrevivir al cierre del modal para poder leerse.
  it('cierra el diálogo y confirma fuera de él', async () => {
    publishMock.mockResolvedValue({ kind: 'published', review: ownReview });
    mount();

    await publish();

    expect(await screen.findByText(/ya cuenta en el promedio/)).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // SC-005: sin este segundo pedido el autor ve su propio promedio viejo.
  it('vuelve a pedir los resúmenes del curso', async () => {
    publishMock.mockResolvedValue({ kind: 'published', review: ownReview });
    mount();

    await screen.findByRole('button', { name: `Puntuar a ${TEACHER}` });
    expect(summariesMock).toHaveBeenCalledTimes(1);

    await publish();

    await vi.waitFor(() => expect(summariesMock).toHaveBeenCalledTimes(2));
  });

  it('un rechazo no cierra el diálogo ni confirma', async () => {
    publishMock.mockResolvedValue({
      kind: 'rate_limit',
      releaseAt: '2026-07-30T15:45:00.000Z',
      message: 'Alcanzaste el límite.',
    });
    mount();

    await publish();

    expect(await screen.findByText(/Podrás volver a publicar/)).toBeDefined();
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.queryByText(/ya cuenta en el promedio/)).toBeNull();
  });
});
