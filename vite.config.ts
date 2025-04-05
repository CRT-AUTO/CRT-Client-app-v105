import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ['lucide-react'],
      esbuildOptions: {
        define: {
          global: 'globalThis',
        },
      },
      include: ['@supabase/supabase-js'],
    },
    build: {
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'chart-vendor': ['recharts'],
            'supabase-vendor': ['@supabase/supabase-js']
          }
        }
      }
    },
    server: {
      port: 3000,
      host: true,
      strictPort: true,
      hmr: {
        overlay: false
      },
      // Enhanced CORS configuration for development
      cors: {
        origin: '*',
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Client-Info'],
        exposedHeaders: ['Content-Length', 'X-Supabase-Range'],
        preflightContinue: false,
        optionsSuccessStatus: 204
      },
      headers: {
        // Add additional security headers for development
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Client-Info',
        'Access-Control-Expose-Headers': 'Content-Length, X-Supabase-Range',
      }
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        './runtimeConfig': './runtimeConfig.browser',
      }
    },
    define: {
      // Extract environment variables to make them available in the client
      'process.env': {
        VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY,
        VITE_META_APP_ID: env.VITE_META_APP_ID,
        VITE_APP_URL: env.VITE_APP_URL,
        NODE_ENV: mode
      },
      'global': 'window',
    },
    esbuild: {
      logOverride: { 'this-is-undefined-in-esm': 'silent' }
    }
  };
});