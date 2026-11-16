import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { full_name, school_name, roll_number, class_name, curriculum, password, guardian_email } = await req.json();
    if (!full_name || !school_name || !roll_number || !class_name || !password || password.length < 8) {
      return Response.json({ error: "Please complete all required fields. Password must be at least 8 characters." }, { status: 400, headers: corsHeaders });
    }
    if (!["TN State Board", "CBSE"].includes(curriculum)) return Response.json({ error: "Invalid curriculum." }, { status: 400, headers: corsHeaders });
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(url, serviceKey);
    const schoolKey = school_name.trim().toLowerCase().replace(/\s+/g, " ");
    const rollKey = roll_number.trim().toLowerCase();
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${schoolKey}:${rollKey}`));
    const alias = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2,"0")).join("") + "@students.invalid";
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: alias, password, email_confirm: true,
      user_metadata: { role: "student", full_name, school_name: school_name.trim(), school_key: schoolKey, roll_key: rollKey, class_name, curriculum, guardian_email: guardian_email || null }
    });
    if (createError) throw createError;
    const { error: profileError } = await admin.from("profiles").insert({
      id: created.user.id, role: "student", full_name, school_name: school_name.trim(),
      school_key: schoolKey, roll_key: rollKey, class_name, curriculum, guardian_email: guardian_email || null
    });
    if (profileError) { await admin.auth.admin.deleteUser(created.user.id); throw profileError; }
    const publicClient = createClient(url, anonKey);
    const { data: sessionData, error: signInError } = await publicClient.auth.signInWithPassword({ email: alias, password });
    if (signInError) throw signInError;
    return Response.json({ access_token: sessionData.session?.access_token, refresh_token: sessionData.session?.refresh_token }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Student signup failed." }, { status: 400, headers: corsHeaders });
  }
});