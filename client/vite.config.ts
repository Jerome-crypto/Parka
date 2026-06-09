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
    // Fixes "Cannot access 'X' before initialization" TDZ errors caused by
    // Rollup chunk ordering in production. Manual chunks enforce stable
    // module initialization order.
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime
          'vendor-react': ['react', 'react-dom', 'react-router'],
          // Data fetching and state
          'vendor-query': ['@tanstack/react-query'],
          // Charts
          'vendor-charts': ['recharts'],
          // Socket.io client
          'vendor-socket': ['socket.io-client'],
          // QR scanning
          'vendor-qr': ['html5-qrcode'],
          // Icons
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
})
