-- Las 16 carreras de specs/002-resenas-docentes/carreras-utec.md (FR-017).
-- El upsert va por `slug`: un renombre actualiza la fila en vez de crear otra.
insert into public.careers (slug, name, faculty) values
  ('ciencia-de-la-computacion',                  'Ciencia de la Computación',                   'Computación'),
  ('ciencia-de-datos-e-inteligencia-artificial', 'Ciencia de Datos e Inteligencia Artificial',  'Computación'),
  ('ciberseguridad',                             'Ciberseguridad',                              'Computación'),
  ('sistemas-de-informacion',                    'Sistemas de Información',                     'Computación'),
  ('bioingenieria',                              'Bioingeniería',                               'Ingeniería'),
  ('ingenieria-ambiental',                       'Ingeniería Ambiental',                        'Ingeniería'),
  ('ingenieria-civil',                           'Ingeniería Civil',                            'Ingeniería'),
  ('ingenieria-de-la-energia',                   'Ingeniería de la Energía',                    'Ingeniería'),
  ('ingenieria-electronica',                     'Ingeniería Electrónica',                      'Ingeniería'),
  ('ingenieria-industrial',                      'Ingeniería Industrial',                       'Ingeniería'),
  ('ingenieria-mecanica',                        'Ingeniería Mecánica',                         'Ingeniería'),
  ('ingenieria-mecatronica',                     'Ingeniería Mecatrónica',                      'Ingeniería'),
  ('ingenieria-quimica',                         'Ingeniería Química',                          'Ingeniería'),
  ('administracion-y-negocios-digitales',        'Administración y Negocios Digitales',         'Negocios'),
  ('business-analytics',                         'Business Analytics',                          'Negocios'),
  ('fisica',                                     'Física',                                      'Ciencias Básicas')
on conflict (slug) do update
  set name      = excluded.name,
      faculty   = excluded.faculty,
      is_active = true;
