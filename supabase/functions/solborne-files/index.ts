import {createFileHandler} from './handler.mjs';
// Same server-to-server credential fingerprint as solborne-presales. Never a client key.
const keyHash='0b5a8adf67469b06d2403e9d309956edf83ed393728a6926f5f8bd8976053b4b';
Deno.serve(createFileHandler({
 supabaseUrl:Deno.env.get('SUPABASE_URL'),
 serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
 keyHash
}));
