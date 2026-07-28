import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    // Mismo alias que tsconfig.json ("@/*" -> "./src/*"), replicado acá para no
    // sumar la dependencia vite-tsconfig-paths.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Trinquete: el piso es el coverage medido, no un número elegido. Con
      // `autoUpdate` vitest reescribe estos valores cuando el coverage sube, y
      // el CI falla si baja. Así el coverage sólo puede avanzar, sin fijar hoy
      // una meta que la app no puede cumplir (los componentes React están en 0%
      // y no hay jsdom ni testing-library montados).
      //
      // El `autoUpdate` sólo persiste cuando alguien corre coverage en local y
      // commitea el archivo: en el runner la reescritura se descarta.
      thresholds: {
        autoUpdate: true,
        lines: 48.71,
        statements: 49.28,
        functions: 40.95,
        branches: 38.44,
      },
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      // Datos generados y tipos no aportan señal de coverage.
      exclude: ['src/data/**', 'src/types/**'],
    },
  },
});
