// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ReviewsPanel from '@/components/reviews/ReviewsPanel';
import { fetchPairReviews } from '@/lib/api-client';
import type { PairReviewsResponse } from '@/types/reviews';

vi.mock('@/lib/api-client', () => ({ fetchPairReviews: vi.fn() }));

const fetchMock = vi.mocked(fetchPairReviews);

afterEach(cleanup);

beforeEach(() => {
  fetchMock.mockReset();
});

const reviews = (overrides: Partial<PairReviewsResponse> = {}): PairReviewsResponse => ({
  courseTeacherId: 'par-1',
  comments: [],
  own: null,
  ...overrides,
});

const comment = {
  id: 'r-1',
  rating: 4,
  recommends: true,
  comment: 'Explica con calma y responde dudas fuera de clase.',
  publishedAt: '2026-05-12T15:04:05Z',
  editedAt: null,
};

function mount() {
  return render(<ReviewsPanel courseCode="CS2023" teacherEmail="bojeda@utec.edu.pe" />);
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
    expect(container.textContent).not.toMatch(/sé el primero|escribe|publica/i);
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
