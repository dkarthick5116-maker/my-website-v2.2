// Teacher recovery is handled by Supabase Auth resetPasswordForEmail on the frontend.
 // This endpoint is reserved for future server-side audit logging; it does not accept passwords.
import { corsHeaders } from "../_shared/cors.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return Response.json({ error: "Use Supabase Auth email recovery from the teacher login page." }, { status: 405, headers: corsHeaders });
});