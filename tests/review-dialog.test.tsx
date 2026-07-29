// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ReviewDialog from '@/components/reviews/ReviewDialog';
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

/** Un comentario en la respuesta: no debe llegar a la pantalla todavía. */
const comment = {
  id: 'r-1',
  rating: 4,
  recommends: true,
  comment: 'Explica con calma y responde dudas fuera de clase.',
  publishedAt: '2026-05-12T15:04:05Z',
  editedAt: null,
};

function mount(onPublished = vi.fn()) {
  const view = render(
    <ReviewDialog
      courseCode="CS2023"
      teacherEmail="bojeda@utec.edu.pe"
      teacherName="Ojeda Rios, Brenner Humberto"
      onPublished={onPublished}
    />
  );
  return { onPublished, container: view.container };
}

describe('ReviewDialog — carga', () => {
  it('pide el par que recibe', async () => {
    fetchMock.mockResolvedValue({ kind: 'ok', reviews: reviews() });

    mount();

    expect(fetchMock).toHaveBeenCalledWith('CS2023', 'bojeda@utec.edu.pe');
    await screen.findByRole('button', { name: 'Publicar' });
  });

  it('mientras carga no muestra el formulario', async () => {
    let settle!: (value: { kind: 'ok'; reviews: PairReviewsResponse }) => void;
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      })
    );

    mount();

    expect(screen.getByText('Cargando')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull();

    settle({ kind: 'ok', reviews: reviews() });
    expect(await screen.findByRole('button', { name: 'Publicar' })).toBeDefined();
  });

  // Un fallo de red no puede parecerse a un docente sin reseñas (SC-002).
  it('un fallo se distingue del estado vacío', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('red caída')));

    mount();

    expect(await screen.findByText(/No se pudieron cargar las reseñas/)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull();
  });
});

describe('ReviewDialog — comentarios ocultos hasta US4b', () => {
  // Escribir comentarios no existe todavía: mostrarlos dejaría a los 757 pares
  // en «Aún no hay comentarios» para siempre, sin forma de arreglarlo.
  it('no lista los comentarios que llegan en la respuesta', async () => {
    fetchMock.mockResolvedValue({ kind: 'ok', reviews: reviews({ comments: [comment] }) });

    const { container } = mount();

    await screen.findByRole('button', { name: 'Publicar' });
    expect(screen.queryByText(/Explica con calma/)).toBeNull();
    expect(container.textContent).not.toMatch(/comentario/i);
  });

  it('sin comentarios tampoco dice que no los hay', async () => {
    fetchMock.mockResolvedValue({ kind: 'ok', reviews: reviews() });

    const { container } = mount();

    await screen.findByRole('button', { name: 'Publicar' });
    expect(container.textContent).not.toMatch(/Aún no hay comentarios/);
  });
});

describe('ReviewDialog — acceso', () => {
  // FR-013, escenario 8: la invitación a iniciar sesión vive en el diálogo.
  it('sin sesión invita a iniciarla y no ofrece el formulario', async () => {
    fetchMock.mockResolvedValue({ kind: 'anonymous' });

    mount();

    const login = await screen.findByRole('link', { name: 'Iniciar sesión' });
    expect(login.getAttribute('href')).toBe('/auth/login');
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull();
  });

  // FR-057: el motivo, cada vez que intente usar la funcionalidad.
  it('con la cuenta sancionada muestra el motivo', async () => {
    fetchMock.mockResolvedValue({ kind: 'banned', reason: 'Insultos hacia un docente.' });

    mount();

    expect(await screen.findByText(/retirado de forma permanente/)).toBeDefined();
    expect(screen.getByText(/Insultos hacia un docente\./)).toBeDefined();
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
});

describe('ReviewDialog — reseña propia', () => {
  // SC-003: puntuar y recomendar no pide carrera, ciclo ni compromiso.
  it('sin reseña propia ofrece el formulario, y no pide perfil ni compromiso', async () => {
    fetchMock.mockResolvedValue({ kind: 'ok', reviews: reviews() });

    const { container } = mount();

    expect(await screen.findByRole('button', { name: 'Publicar' })).toBeDefined();
    expect(container.textContent).not.toMatch(/carrera|ciclo|normas de respeto/i);
  });

  // FR-027 y T103: sin edición todavía, ver lo publicado evita el callejón.
  it('con reseña propia la muestra en solo lectura y sin prometer edición', async () => {
    fetchMock.mockResolvedValue({ kind: 'ok', reviews: reviews({ own: ownReview }) });

    const { container } = mount();

    expect(await screen.findByText('Tu reseña')).toBeDefined();
    expect(screen.getByText('4 de 5 estrellas')).toBeDefined();
    expect(screen.getByText('Lo recomiendo')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull();
    expect(container.textContent).not.toMatch(/editar|eliminar/i);
  });

  it('un «No» propio se muestra, a diferencia de la lista de comentarios', async () => {
    fetchMock.mockResolvedValue({
      kind: 'ok',
      reviews: reviews({ own: { ...ownReview, recommends: false } }),
    });

    mount();

    expect(await screen.findByText('No lo recomiendo')).toBeDefined();
  });
});

/** Deja el formulario listo y lo envía. */
async function publishDraft() {
  fireEvent.click(await screen.findByRole('checkbox'));
  fireEvent.click(screen.getByRole('radio', { name: '4 estrellas' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Sí' }));
  fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
}

describe('ReviewDialog — publicar', () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue({ kind: 'ok', reviews: reviews() });
  });

  // El diálogo se cierra al publicar, así que la confirmación la muestra quien
  // lo abrió: un aviso dentro del diálogo se iría con él antes de leerse.
  it('avisa al padre en vez de confirmar por su cuenta', async () => {
    publishMock.mockResolvedValue({ kind: 'published', review: ownReview });
    const { onPublished } = mount();

    await publishDraft();

    await vi.waitFor(() => expect(onPublished).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/ya cuenta en el promedio/)).toBeNull();
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
  it('ante un duplicado muestra la reseña que ya existía y no cierra', async () => {
    publishMock.mockResolvedValue({ kind: 'duplicate', own: ownReview });
    const { onPublished } = mount();

    await publishDraft();

    expect(await screen.findByText('Tu reseña')).toBeDefined();
    expect(onPublished).not.toHaveBeenCalled();
  });

  // Si el servidor rechaza un campo, gana su mensaje: es la validación que
  // cuenta, y la del formulario solo evita el viaje.
  it('muestra los errores de campo que devuelve el servidor', async () => {
    publishMock.mockResolvedValue({
      kind: 'invalid',
      errors: { recommends: 'Responde si recomendarías llevar este curso.' },
    });

    mount();
    await publishDraft();

    expect(await screen.findByText('Responde si recomendarías llevar este curso.')).toBeDefined();
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
