import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next. Los patrones llevan "**/" porque
    // en flat config una ruta sin ese prefijo solo matchea la raíz del proyecto,
    // y el build output también aparece anidado (p. ej. dentro de worktrees).
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/next-env.d.ts",
    // Worktrees de agentes: código ajeno y build output, ya ignorado por git.
    ".claude/**",
    // Edge Functions: son Deno, no Next. Se revisan con `deno check`
    // (ver supabase/functions/send-email/deno.json).
    "supabase/functions/**",
  ]),
  {
    // Scripts de Node en CommonJS, no código de la app: require() es correcto acá.
    files: ["scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
