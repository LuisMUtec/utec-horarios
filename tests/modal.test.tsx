// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Modal from '@/components/Modal';

afterEach(cleanup);

function mount(onClose = vi.fn()) {
  const view = render(
    <Modal title="Ojeda Rios, Brenner Humberto" onClose={onClose}>
      <button type="button">Publicar</button>
    </Modal>
  );
  return { onClose, ...view };
}

describe('Modal — semántica', () => {
  it('es un diálogo modal con nombre accesible', () => {
    mount();

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByRole('dialog', { name: 'Ojeda Rios, Brenner Humberto' })).toBeDefined();
  });

  it('muestra su contenido', () => {
    mount();
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeDefined();
  });
});

describe('Modal — cerrar', () => {
  it('con el botón de cerrar', () => {
    const { onClose } = mount();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('con la tecla Escape', () => {
    const { onClose } = mount();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('otra tecla no lo cierra', () => {
    const { onClose } = mount();

    fireEvent.keyDown(document, { key: 'Enter' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('pulsando el fondo', () => {
    const { onClose, container } = mount();

    fireEvent.mouseDown(container.firstChild as Element);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Arrastrar una selección desde dentro y soltar afuera no debería cerrar.
  it('no cierra si el clic empezó dentro del diálogo', () => {
    const { onClose } = mount();

    fireEvent.mouseDown(screen.getByRole('dialog'));

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Modal — foco y desplazamiento', () => {
  it('se lleva el foco al abrirse', () => {
    mount();
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
  });

  // Sin esto el foco vuelve al principio de la página y se pierde la sección
  // que el estudiante estaba mirando.
  it('devuelve el foco a quien lo abrió', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = mount();
    unmount();

    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('bloquea el desplazamiento del fondo mientras está abierto', () => {
    const { unmount } = mount();
    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
