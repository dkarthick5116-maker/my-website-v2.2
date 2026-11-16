// Admin-assisted reset only. Requires a verified school_admin row and a signed-in admin JWT.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return Response.json({ error: "Sign in as an authorised school administrator." }, { status: 401, headers: corsHeaders });
    const { school_name, roll_number, new_password } = await req.json();
    if (!school_name || !roll_number || !new_password || new_password.length < 8) return Response.json({ error: "Provide school, roll number and a new password of at least 8 characters." }, { status: 400, headers: corsHeaders });
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const verifier = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: authData, error: authError } = await verifier.auth.getUser();
    if (authError || !authData.user) return Response.json({ error: "Administrator session is invalid." }, { status: 401, headers: corsHeaders });
    const schoolKey = school_name.trim().toLowerCase().replace(/\s+/g, " ");
    const { data: admin } = await service.from("school_admins").select("school_key").eq("user_id", authData.user.id).maybeSingle();
    if (!admin || admin.school_key !== schoolKey) return Response.json({ error: "You are not an approved administrator for this school." }, { status: 403, headers: corsHeaders });
    const rollKey = roll_number.trim().toLowerCase();
    const { data: student, error: lookupError } = await service.from("profiles").select("id").eq("role","student").eq("school_key",schoolKey).eq("roll_key",rollKey).maybeSingle();
    if (lookupError || !student) return Response.json({ error: "Student account not found." }, { status: 404, headers: corsHeaders });
    const { error: updateError } = await service.auth.admin.updateUserById(student.id, { password: new_password });
    if (updateError) throw updateError;
    return Response.json({ message: "Student password updated by the authorised school administrator." }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Student reset failed." }, { status: 400, headers: corsHeaders });
  }
});