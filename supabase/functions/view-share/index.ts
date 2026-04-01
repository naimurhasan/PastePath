import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ViewShareSchema = z.object({
  id: z.string().min(1).max(36),
  password: z.string().max(100).optional().nullable(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const parsed = ViewShareSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { id, password } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Fetch the share using service role (bypasses RLS)
    const { data: shares, error: fetchError } = await supabase
      .from("shares")
      .select("id, title, data, view_count, password_hash, deleted_at, auto_delete_at")
      .eq("id", id)
      .limit(1);

    if (fetchError || !shares || shares.length === 0) {
      return new Response(
        JSON.stringify({ status: "not_found", requires_password: false, access_granted: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const share = shares[0];

    // Check soft delete
    if (share.deleted_at) {
      return new Response(
        JSON.stringify({ status: "deleted", title: share.title, requires_password: false, access_granted: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiry
    if (share.auto_delete_at && new Date(share.auto_delete_at) <= new Date()) {
      return new Response(
        JSON.stringify({ status: "expired", title: share.title, requires_password: false, access_granted: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check password
    if (share.password_hash) {
      if (!password) {
        return new Response(
          JSON.stringify({ status: "password_required", title: share.title, requires_password: true, access_granted: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const passwordValid = await bcrypt.compare(password, share.password_hash);
      if (!passwordValid) {
        return new Response(
          JSON.stringify({ status: "password_required", title: share.title, requires_password: true, access_granted: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Increment view count
    await supabase
      .from("shares")
      .update({ view_count: share.view_count + 1 })
      .eq("id", id);

    // Return data without password_hash
    return new Response(
      JSON.stringify({
        status: "ok",
        id: share.id,
        title: share.title,
        data: share.data,
        view_count: share.view_count + 1,
        requires_password: !!share.password_hash,
        access_granted: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
