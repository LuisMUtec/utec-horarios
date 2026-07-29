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
      // Ojo con `branches`: el `autoUpdate` lo escribe unas centésimas por
      // encima de lo que después mide el propio gate (todos los reporters dicen
      // 62.29 y él escribe 62.39), así que el valor que deja falla en la
      // corrida siguiente. Si lo reescribe, corrige a mano con lo que diga
      // `coverage/coverage-summary.json` y vuelve a correr para comprobarlo.
      thresholds: {
        autoUpdate: true,
        lines: 64.11,
        statements: 63.97,
        functions: 63.08,
        branches: 62.29,
      },
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      // Datos generados y tipos no aportan señal de coverage.
      exclude: ['src/data/**', 'src/types/**'],
    },
  },
});
