/** Private operator tool. Uses existing authenticated Wrangler, never a public owner API. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const databaseName = 'solborne-public-intake-20261008';
const databaseId = 'f1b2e60a-766d-4cbb-af2a-4bf66badfc69';
const statuses = new Set(['pending', 'reviewing', 'reviewed']);
const completionPattern = /^SW-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const hash = text => createHash('sha256').update(text).digest('hex');
const quote = text => "'" + String(text).replaceAll("'", "''") + "'";
const escape = text => String(text ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));

export function listQuery() {
  return `SELECT c.id AS completion_id, COALESCE(q.status,'legacy-unrecorded') AS status, q.updated_at, COALESCE(c.project_id,c.id) AS project_id, c.parent_completion_id, c.revision_number, c.created_at, NOT EXISTS (SELECT 1 FROM solborne_walk_completions newer WHERE COALESCE(newer.project_id,newer.id)=COALESCE(c.project_id,c.id) AND newer.revision_number>c.revision_number) AS is_latest, r.name, r.contact, json_extract(c.website_facts_json,'$.businessName') AS business_name, a.html_sha256, a.readme_sha256, CASE WHEN a.completion_id IS NULL THEN 'legacy-rendered' ELSE 'saved-files' END AS source_mode, CASE WHEN d.completion_id IS NULL THEN 'pending' ELSE 'released' END AS delivery_state, d.released_at,d.release_basis FROM solborne_walk_completions c JOIN solborne_registrations r ON r.id=c.registration_id LEFT JOIN solborne_owner_reviews q ON q.completion_id=c.id LEFT JOIN solborne_website_artifacts a ON a.completion_id=c.id LEFT JOIN solborne_website_releases d ON d.completion_id=c.id ORDER BY CASE WHEN d.completion_id IS NULL THEN 0 ELSE 1 END, CASE COALESCE(q.status,'legacy-unrecorded') WHEN 'legacy-unrecorded' THEN 0 WHEN 'pending' THEN 1 WHEN 'reviewing' THEN 2 ELSE 3 END, c.created_at ASC, c.id ASC LIMIT 200`;
}

export function releaseLookupQuery(completion) {
  if (!completionPattern.test(completion)) throw new Error('Use a valid completion reference.');
  return `SELECT completion_id,released_at,release_basis FROM solborne_website_releases WHERE completion_id=${quote(completion)}`;
}

export function releaseQuery(completion, now = Date.now(), expectedHashes) {
  if (!completionPattern.test(completion) || !Number.isSafeInteger(now) || now < 0 || !expectedHashes || !/^[a-f0-9]{64}$/.test(expectedHashes.html || '') || !/^[a-f0-9]{64}$/.test(expectedHashes.readme || '')) throw new Error('Use a valid completion reference, release time and verified source hashes.');
  return `INSERT INTO solborne_website_releases (completion_id,released_at,release_basis) SELECT c.id,${now},'reviewed' FROM solborne_walk_completions c JOIN solborne_owner_reviews q ON q.completion_id=c.id JOIN solborne_website_artifacts a ON a.completion_id=c.id WHERE c.id=${quote(completion)} AND q.status='reviewed' AND a.html_sha256=${quote(expectedHashes.html)} AND a.readme_sha256=${quote(expectedHashes.readme)} AND NOT EXISTS (SELECT 1 FROM solborne_website_releases d WHERE d.completion_id=c.id) RETURNING completion_id,released_at,release_basis`;
}

function releaseResult(row, completion, replayed) {
  if (!row || row.completion_id !== completion || !Number.isSafeInteger(row.released_at) || row.released_at < 0 || !['reviewed','grandfathered'].includes(row.release_basis)) throw new Error('No valid release record was confirmed.');
  return {releaseRecorded:true,replayed,release:row};
}

export function releaseVersion(completion, options, {query=executeQuery,clock=Date.now}={}) {
  const existing=query(releaseLookupQuery(completion),options)[0].results;
  if (existing.length===1) return releaseResult(existing[0],completion,true);
  if (existing.length) throw new Error('Release lookup was not confirmed.');
  const verified=verifyFiles(query(filesQuery(completion),options)[0].results[0]);
  const expectedHashes={html:verified.html_sha256,readme:verified.readme_sha256};
  const confirmed=row=>{
    const current=verifyFiles(query(filesQuery(completion),options)[0].results[0]);
    if(current.html_sha256!==expectedHashes.html || current.readme_sha256!==expectedHashes.readme)throw new Error('Source changed after verification. Inspect the private record; no release of the verified files is confirmed.');
    return row;
  };
  let inserted;
  try { inserted=query(releaseQuery(completion,clock(),expectedHashes),options)[0].results; }
  catch(error) {
    const recovered=query(releaseLookupQuery(completion),options)[0].results;
    if (recovered.length===1) return releaseResult(confirmed(recovered[0]),completion,true);
    throw error;
  }
  if (inserted.length===1) return releaseResult(confirmed(inserted[0]),completion,false);
  const raced=query(releaseLookupQuery(completion),options)[0].results;
  if (raced.length===1) return releaseResult(confirmed(raced[0]),completion,true);
  throw new Error('No release was recorded. The version must have verified saved source and an actual reviewed status. Refresh the private queue.');
}

export function reviewQuery(completion, status, expected, now = Date.now()) {
  if (!completionPattern.test(completion) || !statuses.has(status) || !statuses.has(expected) || !Number.isSafeInteger(now) || now < 0) throw new Error('Use a valid completion reference, status and expected current status.');
  if (status === expected) throw new Error('Choose a different review status.');
  return `UPDATE solborne_owner_reviews SET status=${quote(status)},updated_at=${now} WHERE completion_id=${quote(completion)} AND status=${quote(expected)} RETURNING completion_id,status,updated_at`;
}

export function filesQuery(completion) {
  if (!completionPattern.test(completion)) throw new Error('Use a valid completion reference.');
  return `SELECT completion_id,html_content,readme_content,html_sha256,readme_sha256,render_version FROM solborne_website_artifacts WHERE completion_id=${quote(completion)}`;
}

export function verifyFiles(row) {
  if (!row || !completionPattern.test(row.completion_id) || typeof row.html_content !== 'string' || typeof row.readme_content !== 'string' || hash(row.html_content) !== row.html_sha256 || hash(row.readme_content) !== row.readme_sha256) throw new Error('Saved source is missing or its hashes do not match. No files were exported.');
  return row;
}

export function queueHtml(rows, environment) {
  const cards = rows.map(row => `<article><h2>${escape(row.business_name)} <small>Version ${escape(row.revision_number)}</small></h2><p><strong>Review: ${escape(row.status)}</strong> | Delivery: ${escape(row.delivery_state)}${row.release_basis ? ' ('+escape(row.release_basis)+')' : ''} | ${escape(row.source_mode)} | ${row.is_latest ? "Latest saved version" : "Earlier saved version"}</p><dl><dt>Private registration</dt><dd>${escape(row.name)} | ${escape(row.contact)}</dd><dt>Version reference</dt><dd>${escape(row.completion_id)}</dd><dt>Project</dt><dd>${escape(row.project_id)}</dd><dt>Approved on</dt><dd>${escape(new Date(row.created_at).toISOString())}</dd><dt>HTML SHA-256</dt><dd>${escape(row.html_sha256 || 'Legacy facts: no frozen file snapshot')}</dd><dt>README SHA-256</dt><dd>${escape(row.readme_sha256 || 'Legacy facts: no frozen file snapshot')}</dd></dl></article>`).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><meta name="referrer" content="no-referrer"><title>Solborne private owner review queue</title><style>body{margin:0;background:#f1ebdd;color:#211d18;font:1rem/1.6 Arial,sans-serif}main{max-width:60rem;margin:auto;padding:2rem 1rem}h1,h2{font-family:Georgia,serif}article{border:1px solid #8b8274;margin:1rem 0;padding:1rem}small{font:1rem Arial,sans-serif}dt{font-weight:bold}dd{margin:0 0 .7rem;overflow-wrap:anywhere}.notice{padding:1rem;background:#fff8e9}</style></head><body><main><h1>Private owner review queue</h1><p class="notice">${escape(environment)} snapshot. This file contains private registration contact details. Keep it outside public assets and shared release packages.</p><p>Pending means an approved website version was saved. Legacy-unrecorded means an older Worker saved a completion without a private review record; no queue or review status is fabricated for it. Reviewing and reviewed are manual owner records; no client deployment, hosting arrangement, email or promised delivery time is created. Source files remain free; hosting, domain and maintenance are separate.</p><p>Up to 200 versions, pending first. This snapshot does not refresh automatically. Use the private owner tool to record status and inspect saved source.</p>${cards || '<p>No review records found.</p>'}</main></body></html>`;
}

export function parseArguments(args) {
  const [action, ...rest] = args;
  if (!['list','review','files','release'].includes(action)) throw new Error('Usage: owner-queue.mjs list|review|files|release [completion] --wrangler ABSOLUTE_WRANGLER_JS [--remote] [--status STATUS --expect STATUS] [--html]');
  const parsed = { action, remote: false, html: false };
  if (['review','files','release'].includes(action)) parsed.completion = rest.shift();
  for (let index = 0; index < rest.length; index++) {
    const option = rest[index];
    if (option === '--remote') parsed.remote = true;
    else if (option === '--html' && action === 'list') parsed.html = true;
    else if (['--wrangler','--status','--expect'].includes(option) && rest[index + 1] && !rest[index + 1].startsWith('--')) parsed[option.slice(2)] = rest[++index];
    else throw new Error('Unknown or incomplete owner queue option.');
  }
  if (!parsed.wrangler || !isAbsolute(parsed.wrangler) || !/\.(?:js|mjs|cjs)$/i.test(parsed.wrangler)) throw new Error('Provide an absolute path to an existing Wrangler JavaScript entry point. No package is installed by this tool.');
  if (action === 'review') reviewQuery(parsed.completion, parsed.status, parsed.expect);
  if (action === 'files') filesQuery(parsed.completion);
  if (action === 'release') releaseLookupQuery(parsed.completion);
  if (action !== 'review' && (parsed.status || parsed.expect)) throw new Error('Review status options only apply to review.');
  return parsed;
}

export function pinnedConfig(config) {
  const bindings = config.d1_databases || [];
  if (bindings.length !== 1 || bindings[0].binding !== 'DB' || bindings[0].database_name !== databaseName || bindings[0].database_id !== databaseId || config.vars?.SITE_ORIGIN !== 'https://solborne.in') throw new Error('The owner tool requires the approved isolated Solborne D1 binding.');
}

export function executeQuery(sql, options) {
  pinnedConfig(JSON.parse(readFileSync(join(root, 'wrangler.jsonc'), 'utf8')));
  let output;
  try {
    output = execFileSync(process.execPath, [options.wrangler, 'd1', 'execute', databaseName, '--config', join(root, 'wrangler.jsonc'), ...(options.remote ? ['--remote'] : ['--local','--persist-to',join(root,'private-owner','d1')]), '--json', '--command', sql], { cwd: root, encoding:'utf8', stdio:['ignore','pipe','pipe'], timeout:30000, maxBuffer:4*1024*1024, windowsHide:true });
  } catch {
    throw new Error('The existing Wrangler query did not succeed. Check owner Cloudflare access and migration readiness privately; no successful operation is claimed.');
  }
  let responses;
  try { responses = JSON.parse(output); } catch { throw new Error('Wrangler returned an unreadable result. Check the outcome privately before retrying a status change.'); }
  if (!Array.isArray(responses) || !responses.length || responses.some(response => response.success === false || !Array.isArray(response.results))) throw new Error('Wrangler did not confirm the query. Check the outcome privately before retrying a status change.');
  return responses;
}

export function main(args = process.argv.slice(2)) {
  const options = parseArguments(args);
  const environment = options.remote ? 'Existing hosted D1' : 'Local D1 development';
  if (options.action==='release') { process.stdout.write(JSON.stringify({environment,...releaseVersion(options.completion,options)})+'\n');return; }
  const sql = options.action === 'list' ? listQuery() : options.action === 'review' ? reviewQuery(options.completion,options.status,options.expect) : filesQuery(options.completion);
  const responses = executeQuery(sql, options);
  const outputDir = join(root, 'private-owner');
  if (options.action === 'list') {
    const rows = responses[0].results;
    if (options.html) { mkdirSync(outputDir,{recursive:true});const path=join(outputDir,'queue.html');writeFileSync(path,queueHtml(rows,environment));process.stdout.write(JSON.stringify({environment,versions:rows.length,privateSnapshot:path})+'\n'); }
    else process.stdout.write(JSON.stringify({environment,versions:rows},null,2)+'\n');
  } else if (options.action === 'review') {
    const changed = responses[0].results;
    if (changed.length !== 1 || changed[0].completion_id !== options.completion || changed[0].status !== options.status) throw new Error('No status change was confirmed. The reference is missing or the expected status is stale. Refresh the private queue before trying again.');
    process.stdout.write(JSON.stringify({environment,statusChangeRecorded:true,version:changed[0]})+'\n');
  } else {
    const row = verifyFiles(responses[0].results[0]);
    const directory=join(outputDir,'source',row.completion_id);mkdirSync(directory,{recursive:true});
    writeFileSync(join(directory,'index.html'),row.html_content);writeFileSync(join(directory,'README.txt'),row.readme_content);
    process.stdout.write(JSON.stringify({environment,completion:row.completion_id,privateSource:directory,indexSha256:row.html_sha256,readmeSha256:row.readme_sha256})+'\n');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch(error) { process.stderr.write(error.message+'\n');process.exitCode=1; }
}
