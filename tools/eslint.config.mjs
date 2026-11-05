// Static checks on the assembled page code and the engine (audit ARCH-04 / CR-05): no undefined names, no dead code.
// CI: npx eslint@9.14.0 -c tools/eslint.config.mjs --max-warnings 0 build/app.js src/engine.js
const base = {
  languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: { window: 'readonly', document: 'readonly', navigator: 'readonly', location: 'readonly', history: 'readonly', localStorage: 'readonly', fetch: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly', performance: 'readonly', getComputedStyle: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', AbortController: 'readonly', Blob: 'readonly', Image: 'readonly', ClipboardItem: 'readonly', Notification: 'readonly', DOMParser: 'readonly', File: 'readonly', console: 'readonly', innerWidth: 'readonly', module: 'writable', ENGINE: 'readonly', TEXT: 'readonly', EXPLAIN: 'readonly', GAME: 'readonly', Response: 'readonly', AbortSignal: 'readonly', btoa: 'readonly', atob: 'readonly', HTMLElement: 'readonly', IntersectionObserver: 'readonly', ResizeObserver: 'readonly', matchMedia: 'readonly', Intl: 'readonly', CSS: 'readonly', process: 'readonly', require: 'readonly', globalThis: 'readonly' } },
  rules: { 'no-undef': 'error', 'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }], 'no-unreachable': 'error', 'no-dupe-keys': 'error', 'no-self-assign': 'error', 'no-redeclare': 'error', 'no-cond-assign': 'warn', 'no-fallthrough': 'warn', 'use-isnan': 'error', 'valid-typeof': 'error', 'no-constant-condition': 'warn', 'no-unsafe-finally': 'error', 'eqeqeq': 'off' } };
// the engine defines ENGINE itself; the page reads it as a global
export default [
  { ...base, files: ['build/app.js'] },
  { ...base, files: ['src/engine.js'], languageOptions: { ...base.languageOptions, globals: { ...base.languageOptions.globals, ENGINE: 'off' } } },
];
