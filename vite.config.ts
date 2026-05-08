import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
  clearScreen: false,
  optimizeDeps: {
    rolldownOptions: {
      transform: {
        jsx: {
          importSource: 'solid-js',
        },
      },
    },
  },
  environments: {
    client: {
      consumer: 'client',
      build: {
        outDir: 'dist/client',
        emptyOutDir: true,
      },
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
