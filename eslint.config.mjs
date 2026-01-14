import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const legacyGlobs = [
  "app/**",
  "components/**",
  "contexts/**",
  "hooks/**",
  "lib/**",
  "server-signaling.js",
];

// Mantenha verificação estrita em áreas novas/tocadas (IA/chamados) e alivie regras em pastas legadas.
const protectedGlobs = [
  "app/api/chamados/**",
  "app/api/ai/**",
  "app/chamados/**",
  "components/SupportRequestForm.tsx",
  "components/SupportRequestsList.tsx",
];

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
  ]),
  {
    name: "legacy-softened-rules",
    files: legacyGlobs,
    ignores: protectedGlobs,
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-use-before-define": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "prefer-const": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
]);

export default eslintConfig;
