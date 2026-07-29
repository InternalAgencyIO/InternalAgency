import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // vinext/Sites serves these route anchors directly; Next's Link-only
      // assumption does not apply to this worker build.
      "@next/next/no-html-link-for-pages": "off",
      // Hostname-derived language selection intentionally hydrates from the
      // browser because both domains share one build artifact.
      "react-hooks/set-state-in-effect": "off",
      // The IA/// wordmark intentionally contains slash text next to JSX.
      "react/jsx-no-comment-textnodes": "off",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
