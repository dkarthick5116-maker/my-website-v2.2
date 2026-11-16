import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { school_name, roll_number, password } = await req.json();
    if (!school_name || !roll_number || !password) return Response.json({ error: "Enter school, roll number and password." }, { status: 400, headers: corsHeaders });
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const publicClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);
    const schoolKey = school_name.trim().toLowerCase().replace(/\s+/g, " ");
    const rollKey = roll_number.trim().toLowerCase();
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${schoolKey}:${rollKey}`));
    const alias = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2,"0")).join("") + "@students.invalid";
    const { data, error } = await publicClient.auth.signInWithPassword({ email: alias, password });
    if (error || !data.session) throw new Error("School name, roll number or password is incorrect.");
    const { data: profile } = await admin.from("profiles").select("role,school_key").eq("id", data.user.id).maybeSingle();
    if (!profile || profile.role !== "student" || profile.school_key !== schoolKey) {
      await publicClient.auth.signOut();
      throw new Error("This account is not authorised for this school.");
    }
    return Response.json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Student login failed." }, { status: 401, headers: corsHeaders });
  }
});