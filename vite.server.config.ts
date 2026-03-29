import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: 'server/index.ts',
    outDir: 'dist/server',
    emptyOutDir: false,
    target: 'node24',
    rolldownOptions: {
      output: {
        entryFileNames: 'server.js',
      },
    },
  },
})
