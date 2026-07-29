// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import CommentList from '@/components/reviews/CommentList';
import type { PairComment } from '@/types/reviews';

afterEach(cleanup);

const comment = (partial: Partial<PairComment> = {}): PairComment => ({
  id: 'r-1',
  rating: 4,
  recommends: true,
  comment: 'Explica con calma y responde dudas fuera de clase.',
  publishedAt: '2026-05-12T15:04:05Z',
  editedAt: null,
  ...partial,
});

describe('CommentList', () => {
  // FR-035
  it('muestra texto, puntuación, recomendación y fecha', () => {
    render(<CommentList comments={[comment()]} />);

    expect(screen.getByText(/Explica con calma/)).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
    expect(screen.getByText('lo recomienda')).toBeDefined();
    expect(screen.getByText(/12 de mayo de 2026/)).toBeDefined();
  });

  it('no anuncia recomendación cuando no la hay', () => {
    render(<CommentList comments={[comment({ recommends: false })]} />);
    expect(screen.queryByText('lo recomienda')).toBeNull();
  });

  // FR-019, SC-006: no es que no se pinte, es que el tipo no lo trae.
  it('no pinta nada del autor', () => {
    const { container } = render(<CommentList comments={[comment()]} />);
    expect(container.textContent).not.toMatch(/autor|@utec\.edu\.pe|ciclo|carrera/i);
  });

  // FR-055: la marca acompaña a la fecha de publicación, no la reemplaza.
  it('marca el comentario editado sin cambiarle la fecha', () => {
    render(
      <CommentList
        comments={[comment({ editedAt: '2026-06-30T10:00:00Z' })]}
      />
    );

    expect(screen.getByText(/12 de mayo de 2026/)).toBeDefined();
    expect(screen.getByText('(editado)')).toBeDefined();
    expect(screen.queryByText(/30 de junio/)).toBeNull();
  });

  it('sin edición no aparece la marca', () => {
    render(<CommentList comments={[comment()]} />);
    expect(screen.queryByText('(editado)')).toBeNull();
  });

  // FR-034: el orden llega resuelto de la consulta y la lista no lo altera.
  it('respeta el orden en que recibe los comentarios', () => {
    render(
      <CommentList
        comments={[
          comment({ id: 'a', comment: 'El más reciente' }),
          comment({ id: 'b', comment: 'El del medio' }),
          comment({ id: 'c', comment: 'El más antiguo' }),
        ]}
      />
    );

    const textos = screen.getAllByRole('listitem').map((item) => item.textContent ?? '');
    expect(textos[0]).toContain('El más reciente');
    expect(textos[2]).toContain('El más antiguo');
  });

  it('las estrellas no se leen dos veces: el texto equivalente es uno solo', () => {
    render(<CommentList comments={[comment({ rating: 3 })]} />);
    expect(screen.getByText('3 de 5 estrellas')).toBeDefined();
  });
});
