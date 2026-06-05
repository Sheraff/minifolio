/// <reference types="vitest/config" />

import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
  clearScreen: false,
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
  environments: {
    client: {
      consumer: 'client',
      build: {
        outDir: 'dist/client',
        emptyOutDir: true,
        modulePreload: { polyfill: false },
      },
      optimizeDeps: {
        rolldownOptions: {
          transform: {
            jsx: {
              importSource: 'solid-js',
            },
          },
        }
      }
    },
    server: {
      consumer: 'server',
      build: {
        ssr: 'server/index.ts',
        outDir: 'dist/server',
        emptyOutDir: true,
        target: 'node24',
        rolldownOptions: {
          output: {
            entryFileNames: 'server.js',
          },
        },
      }
    }
  }
})
