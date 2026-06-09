import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    // Fixes "Cannot access 'X' before initialization" TDZ errors.
    // recharts deeply depends on React hooks/internals so they MUST be in
    // the same chunk. A function-based manualChunks handles all transitive
    // deps correctly (unlike a static object which can split shared deps).
    rollupOptions: {
      output: {
        manualChunks(id) {
          // recharts must live with React – it uses React hooks at module
          // evaluation time, so splitting them causes TDZ crashes.
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/recharts') ||
            id.includes('node_modules/d3-') ||
            id.includes('node_modules/victory-') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'vendor-react';
          }
          // Data fetching
          if (id.includes('node_modules/@tanstack/')) {
            return 'vendor-query';
          }
          // Socket.io
          if (id.includes('node_modules/socket.io-client') || id.includes('node_modules/engine.io-client')) {
            return 'vendor-socket';
          }
          // QR scanning (large – isolated to avoid polluting main chunk)
          if (id.includes('node_modules/html5-qrcode')) {
            return 'vendor-qr';
          }
          // Icons
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
        },
      },
    },
  },
})
