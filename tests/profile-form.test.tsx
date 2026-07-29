// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ProfileForm from '@/components/ProfileForm';
import { fetchCareers, updateProfile } from '@/lib/api-client';
import type { Career } from '@/lib/careers';
import type { Profile } from '@/lib/profile';

vi.mock('@/lib/api-client', () => ({
  fetchCareers: vi.fn(),
  updateProfile: vi.fn(),
}));

const careersMock = vi.mocked(fetchCareers);
const saveMock = vi.mocked(updateProfile);

const CATALOG: Career[] = [
  { slug: 'ciencia-de-la-computacion', name: 'Ciencia de la Computación', faculty: 'Computación' },
  { slug: 'fisica', name: 'Física', faculty: 'Ciencias Básicas' },
];

const empty: Profile = { careerSlug: null, careerName: null, term: null };

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  careersMock.mockResolvedValue(CATALOG);
});

/** Los dos selectores del formulario, por su etiqueta. */
const career = () => screen.getByLabelText('Carrera') as HTMLSelectElement;
const term = () => screen.getByLabelText('Ciclo actual') as HTMLSelectElement;

async function mount(initial: Profile = empty) {
  const view = render(<ProfileForm initial={initial} />);
  // El catálogo llega por fetch: sin esperarlo, el selector aún dice «Cargando».
  await screen.findByRole('option', { name: 'Física' });
  return view;
}

describe('ProfileForm', () => {
  it('agrupa las carreras por facultad, en orden', async () => {
    await mount();

    const groups = [...career().querySelectorAll('optgroup')].map((g) => g.label);
    expect(groups).toEqual(['Ciencias Básicas', 'Computación']);
  });

  it('parte de lo que el estudiante ya tenía guardado', async () => {
    await mount({ careerSlug: 'fisica', careerName: 'Física', term: 7 });

    expect(career().value).toBe('fisica');
    expect(term().value).toBe('7');
  });

  // FR-016: leer no exige nada de esto.
  it('dice que carrera y ciclo son opcionales para leer', async () => {
    const { container } = await mount();
    expect(container.textContent).toMatch(/opcionales para leer/i);
  });

  // FR-017
  it('avisa cuando falta algo para poder comentar', async () => {
    const { container } = await mount({ careerSlug: 'fisica', careerName: 'Física', term: null });
    expect(container.textContent).toMatch(/faltan datos/i);
  });

  it('no avisa cuando el perfil está completo', async () => {
    const { container } = await mount({ careerSlug: 'fisica', careerName: 'Física', term: 3 });
    expect(container.textContent).not.toMatch(/faltan datos/i);
  });

  // Mandar los dos campos haría que corregir el ciclo reescribiera la carrera.
  it('manda sólo el campo que cambió', async () => {
    saveMock.mockResolvedValue({
      ok: true,
      profile: { careerSlug: 'fisica', careerName: 'Física', term: 4 },
    });

    await mount({ careerSlug: 'fisica', careerName: 'Física', term: 3 });
    fireEvent.change(term(), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(saveMock).toHaveBeenCalledWith({ term: 4 });
    expect(await screen.findByText(/quedó guardado/)).toBeDefined();
  });

  it('sin cambios no viaja nada y lo dice', async () => {
    await mount({ careerSlug: 'fisica', careerName: 'Física', term: 3 });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(saveMock).not.toHaveBeenCalled();
    expect(screen.getByText('No hay nada que actualizar.')).toBeDefined();
  });

  it('vaciar un selector se guarda como sin especificar', async () => {
    saveMock.mockResolvedValue({ ok: true, profile: empty });

    await mount({ careerSlug: 'fisica', careerName: 'Física', term: 3 });
    fireEvent.change(career(), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(saveMock).toHaveBeenCalledWith({ careerSlug: null });
  });

  it('pinta el error del servidor junto a su campo', async () => {
    saveMock.mockResolvedValue({ ok: false, errors: { term: 'El ciclo va del 1 al 10.' } });

    await mount();
    fireEvent.change(term(), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('El ciclo va del 1 al 10.')).toBeDefined();
    expect(screen.queryByText(/quedó guardado/)).toBeNull();
  });

  // FR-057: sancionado con la página abierta.
  it('muestra el motivo de la sanción si llega al guardar', async () => {
    saveMock.mockResolvedValue({
      ok: false,
      errors: { form: 'Tu acceso fue retirado. Motivo: Insultos hacia un docente.' },
    });

    await mount();
    fireEvent.change(term(), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.getByText(/Insultos hacia un docente/)).toBeDefined();
  });

  it('un fallo de red no se traga en silencio', async () => {
    saveMock.mockImplementation(() => Promise.reject(new Error('red caída')));

    await mount();
    fireEvent.change(term(), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText(/Revisa tu conexión/)).toBeDefined();
  });

  // Sin esto el selector la borraría de la vista y el primer guardado la
  // perdería sin que el estudiante lo pidiera.
  it('conserva la carrera que salió del catálogo vigente', async () => {
    await mount({ careerSlug: 'quimica', careerName: 'Ingeniería Química', term: 3 });

    expect(screen.getByRole('option', { name: /Ingeniería Química \(ya no vigente\)/ })).toBeDefined();
    expect(career().value).toBe('quimica');
  });

  it('si el catálogo no carga, el ciclo se sigue pudiendo actualizar', async () => {
    careersMock.mockImplementation(() => Promise.reject(new Error('503')));
    saveMock.mockResolvedValue({ ok: true, profile: { ...empty, term: 5 } });

    render(<ProfileForm initial={empty} />);
    expect(await screen.findByText(/No se pudo cargar la lista de carreras/)).toBeDefined();

    fireEvent.change(term(), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(saveMock).toHaveBeenCalledWith({ term: 5 });
  });
});
