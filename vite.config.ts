import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import topLevelAwait from 'vite-plugin-top-level-await'
import wasm from 'vite-plugin-wasm'
import { compression } from 'vite-plugin-compression2'
import inject from '@rollup/plugin-inject'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    topLevelAwait(),
    wasm(),
    compression({
      algorithm: 'brotliCompress',
      exclude: [/\.(png|jpg|jpeg|gif|webp|svg)$/]
    }),
    inject({
      assert: ['assert', 'default']
    }),
    nodePolyfills()
  ],

  define: {
    'process.env.NODE_DEBUG': 'false',
    'process.browser': `"true"`,
    'process.version': `"19.0.0"`
  },

  resolve: {
    alias: {
      '@components': path.resolve(__dirname, 'src/components'),
      '@common': path.resolve(__dirname, 'src/common'),
      '@containers': path.resolve(__dirname, 'src/containers'),
      '@pages': path.resolve(__dirname, 'src/pages'),
      '@static': path.resolve(__dirname, 'src/static'),
      '@store': path.resolve(__dirname, 'src/store'),
      '@web3': path.resolve(__dirname, 'src/web3'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@': path.resolve(__dirname, 'src'),

      ox: 'ox'
    }
  },

  server: {
    host: 'localhost',
    port: 3000
  },

  build: {
    target: 'es2020',
    sourcemap: false,
    minify: 'esbuild',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 4000,

    rollupOptions: {
      external: ['fs/promises', 'path'],

      plugins: [inject({ Buffer: ['buffer', 'Buffer'] })],

      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],

          ui: [
            '@mui/material',
            '@mui/icons-material',
            '@emotion/react',
            '@emotion/styled',
            'notistack'
          ],

          web3: [
            '@solana/web3.js',
            '@solana/spl-token',
            '@walletconnect/utils',
            '@reown/appkit',
            '@reown/appkit-controllers',
            'ox'
          ],

          charts: ['@nivo/bar', '@nivo/line', '@nivo/pie'],

          store: [
            '@reduxjs/toolkit',
            'redux',
            'redux-saga',
            'redux-persist',
            'react-redux',
            'typed-redux-saga',
            'remeda'
          ],

          utils: ['axios', 'html2canvas']
        }
      }
    }
  },

  optimizeDeps: {
    // include: ['react', 'react-dom', 'ox'],
    esbuildOptions: {
      target: 'es2020'
    }
  }
})
