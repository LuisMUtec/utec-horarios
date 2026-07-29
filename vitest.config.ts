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
      //
      // El `autoUpdate` se le ha visto dejar `branches` unas centésimas por
      // encima de lo medido (escribió 62.39 con todos los reporters diciendo
      // 62.29), y ese valor hace fallar la corrida siguiente. No pasa siempre.
      // Por eso conviene, después de que reescriba, volver a correr coverage
      // limpio y mirar el exit code: si falla, pon lo que diga
      // `coverage/coverage-summary.json`. Cuidado con encadenar la corrida a un
      // `grep` o un `sed`, que se tragan el exit code y la línea de ERROR.
      thresholds: {
        autoUpdate: true,
        lines: 64.19,
        statements: 64.04,
        functions: 63.28,
        branches: 62.51,
      },
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      // Datos generados y tipos no aportan señal de coverage.
      exclude: ['src/data/**', 'src/types/**'],
    },
  },
});
