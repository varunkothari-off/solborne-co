import { fetchNoRedirect } from '../fetchNoRedirect';
/**
 * REAL Google Stitch integration — generates illustrative UI screens for the
 * report. Implemented 2026-08-06 against @google/stitch-sdk (verified from the
 * repo README: package "@google/stitch-sdk", auth via STITCH_API_KEY, MCP
 * backend at stitch.googleapis.com/mcp, `stitch.project(id).generate(prompt,
 * deviceType)` -> `screen.getImage()` returns a screenshot download URL).
 *
 * The SDK is loaded with a DYNAMIC import so (a) the stub path never pulls it
 * in, and (b) if the package isn't installed the feature degrades to "no
 * images" instead of breaking the build/report — it is an optional dependency
 * on purpose. Errors here are swallowed by the orchestrator (wireframes.ts):
 * the report must always render, with or without wireframes.
 *
 * FLAGGED UNCERTAINTY: the README documents `callTool("create_project", {
 * title })` but NOT the exact field carrying the new project id in the
 * response. extractProjectId() below probes the likely shapes; if Stitch
 * changes that shape this is the first thing to check. Rate limits are also
 * undocumented in the SDK README (Stitch's site claims ~350 generations/month
 * on the free Standard tier — unverified here); the RATE_LIMITED StitchError
 * is treated as a normal failure and simply yields no images.
 */
import { requireEnv } from '../env';
import type {
  GeneratedWireframe,
  StitchProvider,
  WireframeRequest,
} from '../stitch';

/** Load the SDK without letting the bundler hard-require it at build time. */
async function loadSdk(): Promise<any> {
  const pkg = '@google/stitch-sdk';
  return import(/* @vite-ignore */ pkg);
}

/** Best-effort extraction of a project id from create_project's result,
 *  whose exact shape isn't pinned down in the SDK README. */
function extractProjectId(result: unknown): string | null {
  const probe = (v: unknown): string | null => {
    if (!v) return null;
    if (typeof v === 'string') {
      // May be a bare id, or JSON, or an MCP text block — try to dig an id out.
      const m = v.match(/(?:projects\/)?([0-9]{6,})/);
      return m ? m[1] : null;
    }
    if (typeof v === 'object') {
      const o = v as Record<string, unknown>;
      for (const key of ['projectId', 'project_id', 'id', 'name']) {
        const got = probe(o[key]);
        if (got) return got;
      }
      if (o.project) return probe(o.project);
      if (Array.isArray(o.content)) {
        for (const block of o.content) {
          const got = probe((block as Record<string, unknown>)?.text ?? block);
          if (got) return got;
        }
      }
    }
    return null;
  };
  return probe(result);
}

async function downloadImage(url: string): Promise<{ image: Buffer; mime: string }> {
  const res = await fetchNoRedirect(url);
  if (!res.ok) throw new Error(`wireframe image download failed (${res.status})`);
  const mime = res.headers.get('content-type') || 'image/png';
  const buf = Buffer.from(await res.arrayBuffer());
  return { image: buf, mime };
}

export const stitchReal: StitchProvider = {
  name: 'stitch',
  isStub: false,

  async generate(requests: WireframeRequest[]): Promise<GeneratedWireframe[]> {
    const apiKey = requireEnv('STITCH_API_KEY');
    const sdk = await loadSdk();
    const client = new sdk.StitchToolClient({ apiKey });
    try {
      const stitch = new sdk.Stitch(client);

      // One project holds both screens.
      const created = await client.callTool('create_project', {
        title: 'Solborne — recommended solution',
      });
      const projectId = extractProjectId(created);
      if (!projectId) {
        throw new Error('could not resolve Stitch project id from create_project');
      }
      const project = stitch.project(projectId);

      const out: GeneratedWireframe[] = [];
      for (const req of requests) {
        try {
          const screen = await project.generate(req.prompt, req.deviceType);
          const url = await screen.getImage();
          const { image, mime } = await downloadImage(url);
          out.push({
            label: req.label,
            deviceType: req.deviceType,
            image,
            mime,
            stub: false,
          });
        } catch (err) {
          // One screen failing must not sink the rest.
          console.warn(`[stitch] screen "${req.label}" failed:`, err);
        }
      }
      return out;
    } finally {
      await client.close?.().catch?.(() => {});
    }
  },
};
