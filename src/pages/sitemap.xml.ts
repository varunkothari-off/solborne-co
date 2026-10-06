import type { APIRoute } from 'astro';
import { publicSitemap } from '../lib/publicDiscovery';
export const prerender = true;
export const GET: APIRoute = () => new Response(publicSitemap, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });