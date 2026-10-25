// Canonical public pages only. Experiments, account pages and previews stay noindex.
export const marketingPaths=Object.freeze(['/','/services.html','/operations.html','/websites.html','/how-it-works.html','/about.html','/contact.html','/offer.html','/privacy.html','/terms.html']);
const origin='https://solborne.in';
const organizationId=origin+'/#organization',websiteId=origin+'/#website';
const socialImage=origin+'/assets/solborne-social.jpg';
export const seoConfig=Object.freeze({
 '/':{title:'Business automation and website design | Solborne & Co.',description:'Solborne designs websites and scopes workflows for payment follow-ups, document collection and quotations. Free first website files; automation priced after review.'},
 '/services.html':{title:'Services, scope and outcomes | Solborne & Co.',description:'See Solborne’s business automation and free first website scope: deliverables, intended outcomes, owner decisions, separate costs, timing and the next step.'},
 '/operations.html':{title:'Payments, documents and quotation workflows | Solborne & Co.',description:'Explore illustrative payment, document collection and quotation workflows: routine steps, owner intervention and outcome learning. Scope and price agreed before work.'},
 '/websites.html':{title:'Business websites and free first website files | Solborne & Co.',description:'Explore Solborne website examples and the free first one-page static website: editable source, a reviewed preview and handover. Hosting, domains and automation separate.'},
 '/how-it-works.html':{title:'How website and automation projects work | Solborne & Co.',description:'Understand the steps from a confirmed brief to a reviewed website preview or an agreed workflow proposal. Your approvals, scope, costs and delivery timing explained.'},
 '/about.html':{title:'About Solborne & Co. | Business websites and workflows',description:'Meet Solborne & Co., a brand of KISNO PROPTY LLP in Kolkata, India. Learn our approach to websites, scoped business workflows and human review.'},
 '/contact.html':{title:'Contact Solborne & Co. | Discuss your business workflow',description:'Contact Solborne about business automation, a first website, feedback or complaints. Discuss the work that gets stuck and the next step worth taking.'},
 '/offer.html':{title:'Free first website: what is included | Solborne & Co.',description:'Understand Solborne’s free first static website files, editable source, private reviewed preview and approval process. Domains, hosting and optional paid work are separate.'},
 '/privacy.html':{title:'Privacy and your information | Solborne & Co.',description:'Read how Solborne & Co. handles business enquiries, verified sign-in, website briefs, private files, analytics choices and requests about your information.'},
 '/terms.html':{title:'Website and service terms | Solborne & Co.',description:'Read Solborne’s website and service terms: free website files, review and approval, optional paid work, responsibilities, access, intellectual property and contact details.'}
});
function attribute(tag,name){const match=tag.match(new RegExp('(?:^|\\s)'+name+'\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))','i'));return match?(match[1]??match[2]??match[3]):'';}
function escapeHtml(value){return String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');}
function safeJson(value){return JSON.stringify(value).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');}
function graphFor(path,config){
 const url=origin+path,services=origin+'/services.html';
 const organization={'@type':'Organization','@id':organizationId,name:'Solborne & Co.',legalName:'KISNO PROPTY LLP',url:origin+'/',logo:origin+'/assets/solborne-wordmark.svg',email:'varun@getsolborne.com',identifier:{'@type':'PropertyValue',propertyID:'LLPIN',value:'ACK-0281'},address:{'@type':'PostalAddress',streetAddress:'22 Kalakar Street',addressLocality:'Kolkata',addressRegion:'West Bengal',postalCode:'700007',addressCountry:'IN'}};
 const website={'@type':'WebSite','@id':websiteId,url:origin+'/',name:'Solborne & Co.',alternateName:'Solborne',publisher:{'@id':organizationId},inLanguage:'en'};
 const page={'@type':'WebPage','@id':url+'#page',url,name:config.title,description:config.description,inLanguage:'en',isPartOf:{'@id':websiteId},about:{'@id':organizationId}};
 const graph=[page,organization,website];
 if(path==='/services.html'){
  const automation={'@type':'Service','@id':services+'#automation',name:'Scoped business automation',serviceType:'Business workflow design and automation',url:services+'#automation',provider:{'@id':organizationId},description:'Human-reviewed scope for payment follow-ups, document collection or quotations. Price, access, owner decisions and delivery timing are agreed before implementation.'};
  const websiteFiles={'@type':'Service','@id':services+'#website',name:'Free first one-page static website files',serviceType:'Static website design',url:services+'#website',provider:{'@id':organizationId},description:'One responsive static page, editable source and a handover guide. A personally reviewed private preview follows the confirmed brief. Domain, hosting, maintenance, extra pages and automation are separate.'};
  const catalog={'@type':'OfferCatalog','@id':services+'#catalog',name:'Solborne services',itemListElement:[{'@type':'Offer',name:automation.name,url:automation.url,itemOffered:{'@id':automation['@id']}},{'@type':'Offer',name:websiteFiles.name,url:websiteFiles.url,itemOffered:{'@id':websiteFiles['@id']}}]};
  page.mainEntity={'@id':catalog['@id']};organization.hasOfferCatalog={'@id':catalog['@id']};graph.push(automation,websiteFiles,catalog);
 }
 return {'@context':'https://schema.org','@graph':graph};
}

export function applySeo(html,path){
 let requested;try{requested=new URL(path,origin).pathname;}catch{return html;}
 const canonicalPath=['/index.html','/clarity-home.html'].includes(requested)?'/':requested;
 const config=seoConfig[canonicalPath];if(!config)return html;
 // Only replace metadata owned here; fonts, theme, verification, analytics and body survive.
 let source=html.replace(/<!-- solborne-seo:start -->[\s\S]*?<!-- solborne-seo:end -->/g,'').replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi,'');
 source=source.replace(/<meta\b[^>]*>/gi,tag=>{const key=(attribute(tag,'name')||attribute(tag,'property')).toLowerCase();return ['description','robots'].includes(key)||key.startsWith('og:')||key.startsWith('twitter:')?'':tag;});
 source=source.replace(/<link\b[^>]*>/gi,tag=>attribute(tag,'rel').toLowerCase().split(/\s+/).includes('canonical')?'':tag);
 source=source.replace(/<script\b([^>]*)>[\s\S]*?<\/script\s*>/gi,(tag,attrs)=>attribute(attrs,'type').toLowerCase()==='application/ld+json'?'':tag);
 const url=origin+canonicalPath,robots=requested==='/clarity-home.html'?'noindex,follow':'index,follow,max-image-preview:large';
 const tags=[
  '<title>'+escapeHtml(config.title)+'</title>',
  '<meta name="description" content="'+escapeHtml(config.description)+'">',
  '<meta name="robots" content="'+robots+'">',
  '<link rel="canonical" href="'+url+'">',
  '<meta property="og:type" content="website">',
  '<meta property="og:site_name" content="Solborne &amp; Co.">',
  '<meta property="og:title" content="'+escapeHtml(config.title)+'">',
  '<meta property="og:description" content="'+escapeHtml(config.description)+'">',
  '<meta property="og:url" content="'+url+'">',
  '<meta property="og:image" content="'+socialImage+'">',
  '<meta property="og:image:alt" content="Solborne &amp; Co. — business websites and workflows">',
  '<meta name="twitter:card" content="summary_large_image">',
  '<meta name="twitter:title" content="'+escapeHtml(config.title)+'">',
  '<meta name="twitter:description" content="'+escapeHtml(config.description)+'">',
  '<meta name="twitter:image" content="'+socialImage+'">',
  '<meta name="twitter:image:alt" content="Solborne &amp; Co. — business websites and workflows">',
  '<script type="application/ld+json">'+safeJson(graphFor(canonicalPath,config))+'</script>'
 ];
 return source.replace(/<\/head\s*>/i,'<!-- solborne-seo:start -->\n'+tags.join('\n')+'\n<!-- solborne-seo:end --></head>');
}
