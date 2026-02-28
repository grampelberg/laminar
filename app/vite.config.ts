import process from 'node:process'
import { URL, fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vite'

const host = process.env.TAURI_DEV_HOST

export default defineConfig(async () => ({
  clearScreen: false,
  plugins: [
    react({
      babel: {
        presets: ['jotai-babel/preset'],
      },
      jsxImportSource: '@welldone-software/why-did-you-render',
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // eslint-disable-next-line unicorn/relative-url-style
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // eslint-disable-next-line unicorn/relative-url-style
      '~': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: [
      'cmdk',
      'neverthrow',
      'react-dom/client',
      'react-hotkeys-hook',
      'sonner',
      'wouter',
      'zod',
    ],
  },

  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    hmr: host
      ? {
          host,
          port: 1421,
          protocol: 'ws',
        }
      : undefined,
    host: host || false,
    port: 1420,
    strictPort: true,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**', '**/*.md'],
    },
  },
  test: {
    setupFiles: ['./vitest.setup.ts'],
    fileParallelism: false,
    browser: {
      enabled: true,
      provider: playwright({
        persistentContext: true,
      }),
      instances: [{ browser: 'chromium' }],
    },
  },
}))
