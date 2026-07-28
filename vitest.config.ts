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
      // Sin thresholds a propósito: hoy no hay tests de componentes, así que
      // cualquier umbral sería un número inventado. Primero medimos en el CI y
      // recién con el dato real se fija el piso.
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      // Datos generados y tipos no aportan señal de coverage.
      exclude: ['src/data/**', 'src/types/**'],
    },
  },
});
