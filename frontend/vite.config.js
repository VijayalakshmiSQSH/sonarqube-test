import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    cors: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
      'Cross-Origin-Resource-Policy': 'cross-origin'
    },
    // allowedHosts: [
    //   'localhost',
    //   'https://employee-be-prod-475124303668.us-central1.run.app',
    //   'https://employee-fe-prod-475124303668.us-central1.run.app'
    // ]
    allowedHosts: [
      'localhost',
      'employee-be-prod-475124303668.us-central1.run.app',
      'employee-fe-prod-475124303668.us-central1.run.app',
      'iapps.squareshift.co',
      't-iapps.squareshift.co'
    ]
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Suppress deprecation warnings from frappe-gantt
        silenceDeprecations: ['legacy-js-api', 'global-builtin', 'color-functions'],
      },
    },
  },
})
