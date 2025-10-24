import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default [
  js.configs.recommended,
  {
    files: ['client/src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        // Browser globals
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        performance: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        history: 'readonly',
        // DOM globals
        HTMLElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        HTMLAudioElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLTableCaptionElement: 'readonly',
        HTMLTableElement: 'readonly',
        HTMLTableSectionElement: 'readonly',
        HTMLTableRowElement: 'readonly',
        HTMLTableCellElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLParagraphElement: 'readonly',
        HTMLHeadingElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLSpanElement: 'readonly',
        HTMLAnchorElement: 'readonly',
        HTMLUListElement: 'readonly',
        HTMLLIElement: 'readonly',
        HTMLOListElement: 'readonly',
        HTMLOlistElement: 'readonly',
        HTMLImageElement: 'readonly',
        Image: 'readonly',
        CanvasRenderingContext2D: 'readonly',
        CanvasTextAlign: 'readonly',
        // Web APIs
        AudioContext: 'readonly',
        GainNode: 'readonly',
        OscillatorNode: 'readonly',
        SpeechSynthesisUtterance: 'readonly',
        SpeechSynthesis: 'readonly',
        speechSynthesis: 'readonly',
        URLSearchParams: 'readonly',
        EventListener: 'readonly',
        PointerEvent: 'readonly',
        TouchEvent: 'readonly',
        KeyboardEvent: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        // HTML Audio API
        Audio: 'readonly',
        // Service Worker API
        ServiceWorker: 'readonly',
        // React globals
        React: 'readonly',
        // Jest globals (for setup files)
        jest: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        // Web APIs for security and validation utilities
        URL: 'readonly',
        crypto: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        DOMPurify: 'readonly',
        // Event types
        Event: 'readonly',
        MouseEvent: 'readonly',
        TouchEvent: 'readonly',
        KeyboardEvent: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': ts,
      'react': react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...ts.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,

      // Relaxed React Hooks rules for game development
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Custom rules for game development
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/no-unknown-property': 'off', // Disabled for cmdk library CSS classes
      '@typescript-eslint/no-unused-vars': ['warn', { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/heading-has-content': 'warn',
      'jsx-a11y/anchor-has-content': 'warn',
      'no-case-declarations': 'warn',
      'no-empty': 'warn',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    files: ['**/*.{test,spec}.{ts,tsx}', '**/client/src/**/__tests__/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Jest globals for test files
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
        // Test environment globals
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        // All browser globals from main config
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        navigator: 'readonly',
        // DOM element types for test files
        HTMLElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLOListElement: 'readonly',
        Image: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': ts,
      'react': react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...ts.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      // Test-specific rules
      '@typescript-eslint/no-explicit-any': 'off', // Allow any in tests
      'jsx-a11y/click-events-have-key-events': 'off', // Tests don't need full accessibility
      'jsx-a11y/no-static-element-interactions': 'off',
      'jsx-a11y/heading-has-content': 'off',
      'jsx-a11y/anchor-has-content': 'off',
    },
  },
  {
    files: ['server/**/*.{ts,js}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        // Node.js globals
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        // Express globals
        express: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        NextFunction: 'readonly',
        // Server-specific
        Application: 'readonly',
        Router: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': ts,
    },
    rules: {
      ...ts.configs.recommended.rules,

      // Server-specific rules
      '@typescript-eslint/no-explicit-any': 'warn', // Allow but warn about any types
      '@typescript-eslint/no-unused-vars': ['warn', { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off', // Express middleware doesn't need explicit returns
      '@typescript-eslint/explicit-module-boundary-types': 'off', // Allow module boundary flexibility
      '@typescript-eslint/no-empty-function': 'off', // Allow empty middleware functions
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '*.min.js',
      '*.config.js',
      '*.config.ts',
    ],
  },
];
