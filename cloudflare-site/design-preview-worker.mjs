// Visual preview only. No database, credentials, customer writes or auth cookies.
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(['/signin.html','/start.html','/walk.html','/canvas.html','/versions.html'].includes(url.pathname))return Response.redirect('https://solborne.in'+url.pathname+url.search,302);
 if(url.pathname.startsWith('/api/'))return Response.json({enabled:false,authenticated:false,registered:false},{headers:{'X-Robots-Tag':'noindex, nofollow'}});
 const response=await env.ASSETS.fetch(request),headers=new Headers(response.headers);
 headers.set('X-Robots-Tag','noindex, nofollow');
 return new Response(response.body,{status:response.status,headers});
}};
