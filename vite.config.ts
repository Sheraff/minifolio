/// <reference types="vitest/config" />

import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { prerenderPlugin } from './scripts/prerender-plugin'
import { inlineCss } from './scripts/inline-css'
import { gitLogAsset } from './scripts/git-log-asset'

export default defineConfig({
  plugins: [
    solid({ ssr: true }),
    prerenderPlugin(),
    inlineCss(),
    gitLogAsset(),
  ],
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
        chunkImportMap: true,
        rolldownOptions: {
          output: {
            codeSplitting: {
              groups: [
                {
                  name: 'solid',
                  test: /node_modules[\\/]solid-js[\\/]/,
                },
              ],
            },
          },
        },
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
        copyPublicDir: false,
        target: 'node24',
        rolldownOptions: {
          output: {
            entryFileNames: 'server.js',
          },
        },
      }
    },
  }
})
