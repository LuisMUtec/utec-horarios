// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ReviewsPanel from '@/components/reviews/ReviewsPanel';
import { fetchPairReviews, publishReview } from '@/lib/api-client';
import type { OwnReview, PairReviewsResponse } from '@/types/reviews';

vi.mock('@/lib/api-client', () => ({ fetchPairReviews: vi.fn(), publishReview: vi.fn() }));

const fetchMock = vi.mocked(fetchPairReviews);
const publishMock = vi.mocked(publishReview);

afterEach(cleanup);

beforeEach(() => {
  fetchMock.mockReset();
  publishMock.mockReset();
});

const reviews = (overrides: Partial<PairReviewsResponse> = {}): PairReviewsResponse => ({
  courseTeacherId: 'par-1',
  comments: [],
  own: null,
  ...overrides,
});

const ownReview: OwnReview = {
  id: 'r-9',
  rating: 4,
  recommends: true,
  comment: null,
  publishedAt: '2026-07-29T15:04:05Z',
  commentPublishedAt: null,
  commentEditedAt: null,
};

const comment = {
  id: 'r-1',
  rating: 4,
  recommends: true,
  comment: 'Explica con calma y responde dudas fuera de clase.',
  publishedAt: '2026-05-12T15:04:05Z',
  editedAt: null,
};

function mount(onPublished?: () => void) {
  return render(
    <ReviewsPanel
      courseCode="CS2023"
      teacherEmail="bojeda@utec.edu.pe"
      teacherName="Ojeda Rios, Brenner Humberto"
      onPublished={onPublished}
    />
  );
}

describe('ReviewsPanel', () => {
  it('pide el par que recibe', async () => {
    fetchMock.mockResolvedValue({ kind: 'ok', reviews: reviews() });

    mount();

    expect(fetchMock).toHaveBeenCalledWith('CS2023', 'bojeda@utec.edu.pe');
    await screen.findByText('Aún no hay comentarios');
  });

  // SC-002 en su versión del detalle: cargando no puede leerse como vacío.
  it('mientras carga no dice que no hay comentarios', async () => {
    let settle!: (value: { kind: 'ok'; reviews: PairReviewsResponse }) => void;
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      })
    );

    mount();

    expect(screen.getByText('Cargando comentarios')).toBeDefined();
    expect(screen.queryByText('Aún no hay comentarios')).toBeNull();

    settle({ kind: 'ok', reviews: reviews() });
    expect(await screen.findByText('Aún no hay comentarios')).toBeDefined();
  });

  it('lista los comentarios que llegan', async () => {
    fetchMock.mockResolvedValue({ kind: 'ok', reviews: reviews({ comments: [comment] }) });

    mount();

    expect(await screen.findByText(/Explica con calma/)).toBeDefined();
    expect(screen.queryByText('Aún no hay comentarios')).toBeNull();
  });

  // Escenario 27: el promedio vive en el resumen, que no se reemplaza al abrir;
  // acá no se rellena con nada ni se pide contribuir.
  it('sin comentarios lo dice y no invita a escribir', async () => {
    fetchMock.mockResolvedValue({ kind: 'ok', reviews: reviews() });

    const { container } = mount();

    expect(await screen.findByText('Aún no hay comentarios')).toBeDefined();
    // El formulario sí está —es la contribución de US4a—, pero el estado vacío
    // no ruega ni finge comentarios.
    expect(container.textContent).not.toMatch(/sé el primero|todavía nadie se anima/i);
  });

  // FR-013, escenario 8.
  it('sin sesión invita a iniciarla y no muestra lista', async () => {
    fetchMock.mockResolvedValue({ kind: 'anonymous' });

    mount();

    const login = await screen.findByRole('link', { name: 'Iniciar sesión' });
    expect(login.getAttribute('href')).toBe('/auth/login');
    expect(screen.queryByRole('list')).toBeNull();
  });

  // FR-057: el motivo, cada vez que intente leer comentarios.
  it('con la cuenta sancionada muestra el motivo', async () => {
    fetchMock.mockResolvedValue({ kind: 'banned', reason: 'Insultos hacia un docente.' });

    mount();

    expect(await screen.findByText(/retirado de forma permanente/)).toBeDefined();
    expect(screen.getByText(/Insultos hacia un docente\./)).toBeDefined();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('sin motivo no deja un «Motivo:» colgando', async () => {
    fetchMock.mockResolvedValue({ kind: 'banned', reason: '' });

    mount();

    expect(await screen.findByText(/retirado de forma permanente/)).toBeDefined();
    expect(screen.queryByText(/Motivo:/)).toBeNull();
  });

  // R6: el par salió de la oferta.
  it('un par que ya no existe se explica', async () => {
    fetchMock.mockResolvedValue({ kind: 'missing' });

    mount();

    expect(await screen.findByText('Este docente ya no dicta este curso.')).toBeDefined();
  });

  // SC-003: puntuar y recomendar no pide carrera, ciclo ni compromiso.
  it('sin reseña propia ofrece el formulario, y no pide perfil ni compromiso', async () => {
    fetchMock.mockResolvedValue({ kind: 'ok', reviews: reviews() });

    const { container } = mount();

    expect(await screen.findByRole('button', { name: 'Publicar' })).toBeDefined();
    expect(container.textContent).not.toMatch(/carrera|ciclo|normas de respeto/i);
  });

  // FR-027 y T103: sin edición todavía, ver lo publicado es lo que evita el
  // callejón sin salida.
  it('con reseña propia la muestra en solo lectura y no ofrece el formulario', async () => {
    fetchMock.mockResolvedValue({ kind: 'ok', reviews: reviews({ own: ownReview }) });

    mount();

    expect(await screen.findByText('Tu reseña')).toBeDefined();
    expect(screen.getByText('4 de 5 estrellas')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull();
  });

  // Un fallo de red no puede parecerse a un docente sin comentarios (SC-002).
  it('un fallo se distingue del estado vacío', async () => {
    // `mockRejectedValue` arma el rechazo al configurarse y queda sin manejar
    // hasta que el componente lo tome; con una implementación se crea recién en
    // la llamada.
    fetchMock.mockImplementation(() => Promise.reject(new Error('red caída')));

    mount();

    expect(await screen.findByText(/No se pudieron cargar los comentarios/)).toBeDefined();
    expect(screen.queryByText('Aún no hay comentarios')).toBeNull();
  });
});

/** Deja el formulario listo y lo envía. */
async function publishDraft() {
  fireEvent.click(await screen.findByRole('checkbox'));
  fireEvent.click(screen.getByRole('radio', { name: '4 estrellas' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Sí' }));
  fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
}

describe('ReviewsPanel — publicar', () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue({ kind: 'ok', reviews: reviews() });
  });

  // Escenario 19 y SC-005: confirmación, reseña ya reflejada y aviso al padre
  // para que el resumen de arriba deje de estar viejo.
  it('confirma, muestra la reseña y avisa para refrescar el resumen', async () => {
    publishMock.mockResolvedValue({ kind: 'published', review: ownReview });
    const onPublished = vi.fn();

    mount(onPublished);
    await publishDraft();

    expect(await screen.findByText(/ya cuenta en el promedio/)).toBeDefined();
    expect(screen.getByText('Tu reseña')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull();
    expect(onPublished).toHaveBeenCalledTimes(1);
  });

  it('publica contra el par que recibió', async () => {
    publishMock.mockResolvedValue({ kind: 'published', review: ownReview });

    mount();
    await publishDraft();

    expect(publishMock).toHaveBeenCalledWith('CS2023', 'bojeda@utec.edu.pe', {
      declaredAttendance: true,
      rating: 4,
      recommends: true,
    });
  });

  // FR-027, escenario 16: quien ya reseñó ve lo que publicó, no un error seco.
  it('ante un duplicado muestra la reseña que ya existía', async () => {
    publishMock.mockResolvedValue({ kind: 'duplicate', own: ownReview });

    mount();
    await publishDraft();

    expect(await screen.findByText('Tu reseña')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull();
  });

  // FR-030 y FR-031: el texto lleva el instante de liberación.
  it('ante el límite de 24 horas dice cuándo se puede volver', async () => {
    publishMock.mockResolvedValue({
      kind: 'rate_limit',
      releaseAt: '2026-07-30T15:45:00.000Z',
      message: 'Alcanzaste el límite.',
    });

    mount();
    await publishDraft();

    expect(await screen.findByText(/Podrás volver a publicar el 30 de julio/)).toBeDefined();
    // El formulario sigue en pantalla: el bloqueo es temporal.
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeDefined();
  });

  // Edge case *Pérdida de sesión durante la publicación*.
  it('si la sesión se cayó lo dice sin desmontar el formulario', async () => {
    publishMock.mockResolvedValue({ kind: 'anonymous' });

    mount();
    await publishDraft();

    expect(await screen.findByText(/Tu sesión se cerró antes de publicar/)).toBeDefined();
    expect((screen.getByRole('radio', { name: '4 estrellas' }) as HTMLInputElement).checked).toBe(
      true
    );
  });

  // FR-057: el motivo, también al intentar publicar.
  it('una cuenta sancionada recibe el motivo y pierde el formulario', async () => {
    publishMock.mockResolvedValue({ kind: 'banned', reason: 'Datos personales de un tercero.' });

    mount();
    await publishDraft();

    expect(await screen.findByText(/retirado de forma permanente/)).toBeDefined();
    expect(screen.getByText(/Datos personales de un tercero\./)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull();
  });

  // FR-028: el par salió de la oferta con la página abierta.
  it('un par retirado deja de ofrecer el formulario', async () => {
    publishMock.mockResolvedValue({ kind: 'not_current' });

    mount();
    await publishDraft();

    expect(await screen.findByText('Este docente ya no dicta este curso.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull();
  });
});
