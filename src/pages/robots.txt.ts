import type { APIRoute } from 'astro';
import { publicRobots } from '../lib/publicDiscovery';
export const prerender = true;
export const GET: APIRoute = () => new Response(publicRobots, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });