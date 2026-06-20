/// <reference types="vitest/config" />

import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { prerenderPlugin } from './scripts/prerender-plugin'

export default defineConfig({
  plugins: [
    solid({ ssr: true }),
    prerenderPlugin(),
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
    // prerender: {
    //   consumer: 'server',
    //   build: {
    //     ssr: 'src/prerender.tsx',
    //     outDir: 'dist/prerender',
    //     copyPublicDir: false,
    //     emptyOutDir: true,
    //     emitAssets: false,
    //     target: 'node24',
    //     rolldownOptions: {
    //       output: {
    //         entryFileNames: 'prerender.js',
    //       },
    //     },
    //   }
    // }
  }
})
