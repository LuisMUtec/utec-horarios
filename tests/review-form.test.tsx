// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ReviewForm from '@/components/reviews/ReviewForm';
import {
  ATTENDANCE_LABEL,
  MISSING_ATTENDANCE_MESSAGE,
  MISSING_RATING_MESSAGE,
  MISSING_RECOMMENDATION_MESSAGE,
  type ReviewErrors,
} from '@/lib/review-submit';

afterEach(cleanup);

function mount(onPublish = vi.fn<() => Promise<ReviewErrors | null>>()) {
  onPublish.mockResolvedValue(null);
  render(<ReviewForm teacherName="Ojeda Rios, Brenner Humberto" onPublish={onPublish} />);
  return onPublish;
}

const declaration = () => screen.getByRole('checkbox', { name: ATTENDANCE_LABEL });
const stars = (value: number) => screen.getByRole('radio', { name: `${value} estrellas` });
const recommend = (label: string) => screen.getByRole('radio', { name: label });
const publish = () => screen.getByRole('button', { name: 'Publicar' });

/** Deja el formulario listo para enviarse. */
function fill() {
  fireEvent.click(declaration());
  fireEvent.click(stars(4));
  fireEvent.click(recommend('Sí'));
}

describe('ReviewForm — estado inicial', () => {
  it('no preselecciona nada (FR-021, FR-061)', () => {
    mount();

    expect((declaration() as HTMLInputElement).checked).toBe(false);
    expect(screen.getAllByRole('radio').every((radio) => !(radio as HTMLInputElement).checked)).toBe(
      true
    );
  });

  it('ofrece las cinco estrellas y las dos respuestas, y ninguna más', () => {
    mount();

    expect(screen.getByRole('radio', { name: '1 estrella' })).toBeDefined();
    [2, 3, 4, 5].forEach((value) => expect(stars(value)).toBeDefined());
    expect(recommend('Sí')).toBeDefined();
    expect(recommend('No')).toBeDefined();
    expect(screen.getAllByRole('radio')).toHaveLength(7);
  });

  // FR-004 y FR-062: ni la puntuación ni la recomendación miden facilidad.
  it('no habla de facilidad, carga ni dificultad', () => {
    const { container } = render(
      <ReviewForm teacherName="Ojeda Rios, Brenner Humberto" onPublish={vi.fn()} />
    );

    expect(container.textContent).not.toMatch(/fácil|facilidad|difícil|dificultad|carga/i);
  });
});

describe('ReviewForm — publicación', () => {
  it('publica el borrador completo', async () => {
    const onPublish = mount();

    fill();
    fireEvent.click(publish());

    expect(onPublish).toHaveBeenCalledWith({
      declaredAttendance: true,
      rating: 4,
      recommends: true,
    });
  });

  it('`No` es una respuesta, no una falta de respuesta', () => {
    const onPublish = mount();

    fireEvent.click(declaration());
    fireEvent.click(stars(2));
    fireEvent.click(recommend('No'));
    fireEvent.click(publish());

    expect(onPublish).toHaveBeenCalledWith({
      declaredAttendance: true,
      rating: 2,
      recommends: false,
    });
  });

  // Escenario 15: los requisitos pendientes se muestran juntos.
  it('sin nada elegido enumera lo que falta y no viaja al servidor', () => {
    const onPublish = mount();

    fireEvent.click(publish());

    expect(screen.getByText(MISSING_ATTENDANCE_MESSAGE)).toBeDefined();
    expect(screen.getByText(MISSING_RATING_MESSAGE)).toBeDefined();
    expect(screen.getByText(MISSING_RECOMMENDATION_MESSAGE)).toBeDefined();
    expect(onPublish).not.toHaveBeenCalled();
  });

  // Escenario 37: la recomendación es obligatoria por sí sola.
  it('con declaración y estrellas pero sin recomendación tampoco publica', () => {
    const onPublish = mount();

    fireEvent.click(declaration());
    fireEvent.click(stars(5));
    fireEvent.click(publish());

    expect(screen.getByText(MISSING_RECOMMENDATION_MESSAGE)).toBeDefined();
    expect(onPublish).not.toHaveBeenCalled();
  });

  // Escenario 14: el mensaje explica para qué es el espacio.
  it('sin la declaración explica que no es un espacio para preguntas', () => {
    const onPublish = mount();

    fireEvent.click(stars(3));
    fireEvent.click(recommend('Sí'));
    fireEvent.click(publish());

    expect(screen.getByText(/no admite preguntas/i)).toBeDefined();
    expect(onPublish).not.toHaveBeenCalled();
  });
});

describe('ReviewForm — rechazo del servidor', () => {
  it('muestra el error que devuelve el servidor', async () => {
    const onPublish = vi.fn<() => Promise<ReviewErrors | null>>();
    onPublish.mockResolvedValue({ form: 'Alcanzaste el límite de 8 puntuaciones en 24 horas.' });
    render(<ReviewForm teacherName="Docente" onPublish={onPublish} />);

    fill();
    fireEvent.click(publish());

    expect(await screen.findByText(/Alcanzaste el límite/)).toBeDefined();
  });

  // Edge case *Pérdida de sesión durante la publicación*.
  it('conserva lo elegido después de un rechazo', async () => {
    const onPublish = vi.fn<() => Promise<ReviewErrors | null>>();
    onPublish.mockResolvedValue({ form: 'Tu sesión se cerró antes de publicar.' });
    render(<ReviewForm teacherName="Docente" onPublish={onPublish} />);

    fill();
    fireEvent.click(publish());
    await screen.findByText(/Tu sesión se cerró/);

    expect((declaration() as HTMLInputElement).checked).toBe(true);
    expect((stars(4) as HTMLInputElement).checked).toBe(true);
    expect((recommend('Sí') as HTMLInputElement).checked).toBe(true);
  });

  // Un fallo de red no puede dejar el botón en «Publicando…» para siempre.
  it('un fallo inesperado se muestra y devuelve el botón', async () => {
    const onPublish = vi.fn<() => Promise<ReviewErrors | null>>();
    onPublish.mockRejectedValue(new Error('red caída'));
    render(<ReviewForm teacherName="Docente" onPublish={onPublish} />);

    fill();
    fireEvent.click(publish());

    expect(await screen.findByText(/No se pudo publicar la reseña/)).toBeDefined();
    expect((publish() as HTMLButtonElement).disabled).toBe(false);
  });
});
