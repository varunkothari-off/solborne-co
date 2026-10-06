// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  // Owner-confirmed primary domain. DNS and hosting activation are separate.
  site: 'https://solborne.in',

  // Marketing pages stay fully static (prerendered by default). The node
  // adapter exists solely for the onboarding API routes under src/pages/api/,
  // which each set `export const prerender = false`.
  adapter: node({ mode: 'standalone' }),
});
