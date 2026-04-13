const sharedGlobals = {
  window: "readonly",
  document: "readonly",
  localStorage: "readonly",
  indexedDB: "readonly",
  navigator: "readonly",
  confirm: "readonly",
  FormData: "readonly",
  HTMLFormElement: "readonly",
  HTMLInputElement: "readonly",
  URL: "readonly",
  fetch: "readonly",
  WebSocket: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  structuredClone: "readonly",
  process: "readonly",
  Buffer: "readonly",
  global: "readonly",
  module: "readonly",
};

export default [
  {
    ignores: ["dist/**", "node_modules/**", "playwright-report/**", "test-results/**"],
  },
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: sharedGlobals,
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];
