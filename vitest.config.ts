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
    // El default sigue siendo node: jsdom cuesta ~10x en arranque y sólo lo
    // necesitan los tests de componente, que se lo piden con el docblock
    // `// @vitest-environment jsdom`.
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      // Trinquete: el piso es el coverage medido, no un número elegido. Con
      // `autoUpdate` vitest reescribe estos valores cuando el coverage sube, y
      // el CI falla si baja, así que el coverage sólo puede avanzar.
      //
      // El `autoUpdate` sólo persiste cuando alguien corre coverage en local y
      // commitea el archivo: en el runner la reescritura se descarta.
      thresholds: {
        autoUpdate: true,
        lines: 60.2,
        statements: 59.92,
        functions: 56.75,
        branches: 57.92,
      },
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      // Datos generados y tipos no aportan señal de coverage.
      exclude: ['src/data/**', 'src/types/**'],
    },
  },
});
