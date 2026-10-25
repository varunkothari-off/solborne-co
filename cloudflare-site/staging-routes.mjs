// Shared by the disconnected Cloudflare review and loopback-only static preview.
export const stagingPath=url=>url.pathname==='/'&&url.searchParams.get('view')!=='baseline'?'/clarity-home.html':url.pathname;
