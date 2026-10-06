import {defineConfig} from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
/** Isolated Astro-5 candidate; default Node/Railway config is preserved. */
export default defineConfig({site:'https://solborne.in',outDir:'./dist-cloudflare',adapter:cloudflare({imageService:'passthrough',platformProxy:{enabled:false}})});
