// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import TeacherSummary from '@/components/reviews/TeacherSummary';
import type { SummaryState, TeacherSummary as Summary } from '@/types/reviews';

afterEach(cleanup);

const NAME = 'Ojeda Rios, Brenner Humberto';

const summary: Summary = {
  courseTeacherId: 'par-1',
  courseCode: 'CS2023',
  teacherEmail: 'bojeda@utec.edu.pe',
  teacherName: NAME,
  averageRating: 4.3,
  ratingCount: 7,
  commentCount: 2,
  recommendPercentage: 86,
};

const withSummary: SummaryState = { kind: 'summary', summary };

function detail(expanded = false) {
  return { expanded, panelId: 'panel-1', onToggle: vi.fn() };
}

describe('TeacherSummary — estados', () => {
  // SC-002: los tres motivos por los que no hay promedio se distinguen.
  it('separa sin puntuaciones de docente por asignar', () => {
    const { unmount } = render(<TeacherSummary teacherName={NAME} state={{ kind: 'empty' }} />);
    expect(screen.getByText('Sin puntuaciones')).toBeDefined();
    unmount();

    render(<TeacherSummary teacherName={NAME} state={{ kind: 'unassigned' }} />);
    expect(screen.getByText('Docente por asignar')).toBeDefined();
    expect(screen.queryByText('Sin puntuaciones')).toBeNull();
  });

  it('el fallo no se parece a ninguno de los dos', () => {
    render(<TeacherSummary teacherName={NAME} state={{ kind: 'error' }} />);
    expect(screen.getByText('No se pudieron cargar las reseñas')).toBeDefined();
  });

  it('con resumen muestra promedio, conteo y recomendación', () => {
    const { container } = render(<TeacherSummary teacherName={NAME} state={withSummary} />);

    expect(container.textContent).toContain('4.3');
    expect(container.textContent).toContain('7 puntuaciones');
    expect(container.textContent).toContain('86%');
    expect(container.textContent).toContain('2 comentarios');
  });

  // FR-019: el resumen es público y el nombre del docente ya lo imprime la
  // tarjeta; acá sólo entra en el texto equivalente.
  it('no repite el nombre en pantalla', () => {
    render(<TeacherSummary teacherName={NAME} state={withSummary} />);
    // Existe una sola vez, y es la versión para lector de pantalla.
    expect(screen.getAllByText(new RegExp(NAME))).toHaveLength(1);
  });
});

describe('TeacherSummary — abrir el detalle (T062)', () => {
  it('sin detalle no hay botón', () => {
    render(<TeacherSummary teacherName={NAME} state={withSummary} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('con detalle ofrece el botón y lo enlaza al panel', () => {
    render(<TeacherSummary teacherName={NAME} state={withSummary} detail={detail()} />);

    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe('panel-1');
  });

  it('abierto lo dice en el texto y en aria-expanded', () => {
    render(<TeacherSummary teacherName={NAME} state={withSummary} detail={detail(true)} />);

    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.textContent).toContain('Ocultar reseñas');
  });

  it('avisa al padre cuando se pulsa', () => {
    const toggle = detail();
    render(<TeacherSummary teacherName={NAME} state={withSummary} detail={toggle} />);

    screen.getByRole('button').click();

    expect(toggle.onToggle).toHaveBeenCalledTimes(1);
  });

  // Con varios docentes en la sección, «Ver reseñas» a secas no dice de quién.
  it('el nombre accesible del botón incluye al docente', () => {
    render(<TeacherSummary teacherName={NAME} state={withSummary} detail={detail()} />);

    expect(screen.getByRole('button', { name: `Ver reseñas de ${NAME}` })).toBeDefined();
  });

  // El botón vive fuera del span aria-hidden que envuelve al resumen: dentro,
  // no existiría para un lector de pantalla.
  it('el botón no queda escondido dentro del resumen decorativo', () => {
    render(<TeacherSummary teacherName={NAME} state={withSummary} detail={detail()} />);

    expect(screen.getByRole('button').closest('[aria-hidden="true"]')).toBeNull();
  });

  it('sin puntuaciones también se puede abrir', () => {
    render(<TeacherSummary teacherName={NAME} state={{ kind: 'empty' }} detail={detail()} />);
    expect(screen.getByRole('button')).toBeDefined();
  });
});
