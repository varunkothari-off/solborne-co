// Public aggregate only. Customer names, payments and project records remain private.
export async function publicMetrics(env,{fetcher=fetch}={}){
 const response=await fetcher(new URL('/functions/v1/solborne-metrics',env.SUPABASE_URL),{method:'GET',redirect:'manual',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw Error('Metrics unavailable');
 const value=await response.json();
 if(!Number.isSafeInteger(value.businessesHelped)||value.businessesHelped<0||!Number.isSafeInteger(value.freeWebsitesDelivered)||value.freeWebsitesDelivered<0)throw Error('Invalid metrics');
 return {businessesHelped:value.businessesHelped,freeWebsitesDelivered:value.freeWebsitesDelivered};
}
