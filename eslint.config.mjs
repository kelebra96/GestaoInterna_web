import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const legacyGlobs = [
  "app/**",
  "components/**",
  "contexts/**",
  "hooks/**",
  "lib/**",
  "server-signaling.js",
];

const protectedGlobs = [
  "app/api/chamados/**",
  "app/api/ai/**",
  "app/chamados/**",
  "components/SupportRequestForm.tsx",
  "components/SupportRequestsList.tsx",
];

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "myinventory/**",
      "tmp_inventario/**",
      "node_modules/**",
    ],
  },
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
      "react/no-unescaped-entities": "warn",
    },
  },
];

export default eslintConfig;
