import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Codigo Deno, com outras regras e outros globais.
    // Verificado ao servir a funcao, nao por este ESLint.
    "supabase/functions/**",
    // O protótipo de design, como ele saiu da ferramenta. É material
    // de referência para olhar, nunca código que roda aqui — e
    // corrigir lint dele destruiria justamente a fidelidade que faz
    // ele servir de referência.
    "referencia-claude-deisgn/**",
  ]),
]);

export default eslintConfig;
