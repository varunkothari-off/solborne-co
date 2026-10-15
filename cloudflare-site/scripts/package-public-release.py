from pathlib import Path
import shutil,json
src=Path('../solborne-production');dst=Path('cloudflare-site');dst.mkdir(exist_ok=True)
for folder in ['public','src','drizzle','test','config']:
 shutil.copytree(src/folder,dst/folder,dirs_exist_ok=True,ignore=shutil.ignore_patterns('assets.generated.mjs','private-assets.generated.mjs','__pycache__'))
for folder in ['scripts','qa']:
 (dst/folder).mkdir(exist_ok=True)
 for f in (src/folder).iterdir():
  if f.is_file() and (folder=='scripts' or f.name.endswith('.test.mjs')):shutil.copy2(f,dst/folder/f.name)
for name in ['package.json','deployment-worker.mjs','wrangler.jsonc','.gitattributes']:
 if (src/name).exists():shutil.copy2(src/name,dst/name)
(dst/'docs').mkdir(exist_ok=True)
for name in ['studio-design-sources.md','studio-motion-option.md','footer-refinement.md','logo-play-and-kfs.md','ai-activation.md']:
 shutil.copy2(src/'docs'/name,dst/'docs'/name)
(dst/'.gitignore').write_text('node_modules/\n.env\n.env.*\n!.env.example\n.wrangler/\ndist/\nsrc/assets.generated.mjs\nsrc/private-assets.generated.mjs\nprivate/*\n!private/README.md\nevidence/\n*.log\n')
(dst/'private').mkdir(exist_ok=True)
(dst/'private/README.md').write_text('Private deployment inputs\n\nThe production canvas.pdf and canvas.txt remain in the owner workspace and are not published to GitHub. Copy those existing files here before a production build. Never substitute the synthetic CI fixture for a production deployment. Customer records, retry receipts and provider keys must never be placed here or committed.\n')
print('Copied allowlisted source/public assets. Private templates, generated private payloads, credentials and operational evidence excluded.')
