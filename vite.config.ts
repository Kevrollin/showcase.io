import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { BRAND } from './src/config/brand.ts';

/** Fills %BRAND_*% placeholders in index.html so branding stays in one file. */
function originOf(url: string): string {
  try {
    return url ? new URL(url).origin : '';
  } catch {
    return '';
  }
}

function brandHtml(siteUrl: string, supabaseUrl: string): Plugin {
  const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const values: Record<string, string> = {
    BRAND_NAME: BRAND.name,
    BRAND_PROMISE: BRAND.promise,
    BRAND_DESCRIPTION: BRAND.shortDescription,
    BRAND_THEME_COLOR: BRAND.themeColor,
    SITE_URL: siteUrl.replace(/\/+$/, ''),
  };
  return {
    name: 'showcase-brand-html',
    transformIndexHtml(html) {
      const origin = originOf(supabaseUrl);
      // Warm up the connection to the Supabase API/CDN before the app asks for data.
      const preconnect = origin ? `<link rel="preconnect" href="${escape(origin)}" crossorigin />` : '';
      html = html.replace('<!-- %SUPABASE_PRECONNECT% -->', preconnect);
      return html.replace(/%(BRAND_[A-Z_]+|SITE_URL)%/g, (match, key: string) => (key in values ? escape(values[key]!) : match));
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), tailwindcss(), brandHtml(env.VITE_SITE_URL ?? '', env.VITE_SUPABASE_URL ?? '')],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { port: 5173 },
    preview: { port: 4173 },
    build: {
      target: 'es2022',
      sourcemap: false,
      chunkSizeWarningLimit: 400,
      // Never inline fonts as data: URLs — they would be blocked by the
      // production CSP (font-src 'self') and could not be cached separately.
      assetsInlineLimit: (filePath: string) => (/\.(woff2?|ttf|otf)$/.test(filePath) ? false : undefined),
    },
  };
});
