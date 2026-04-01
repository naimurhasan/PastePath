import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CreateShareSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title too long"),
  password: z.string().max(100, "Password too long").optional().nullable(),
  data: z.object({
    images: z.array(z.any()).min(1, "At least one image required").max(20, "Max 20 images"),
  }),
  auto_delete_at: z.string().datetime().optional().nullable(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const parsed = CreateShareSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { title, password, data, auto_delete_at } = parsed.data;

    // Check payload size (rough limit ~5MB)
    const payloadSize = JSON.stringify(data).length;
    if (payloadSize > 5 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "Payload too large. Try fewer or smaller images." }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate server-side ID
    const shareId = crypto.randomUUID().slice(0, 8);

    // Hash password with bcrypt if provided
    let passwordHash: string | null = null;
    if (password && password.length > 0) {
      const salt = await bcrypt.genSalt(12);
      passwordHash = await bcrypt.hash(password, salt);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const { error: insertError } = await supabase.from("shares").insert({
      id: shareId,
      title: title.trim(),
      data,
      password_hash: passwordHash,
      auto_delete_at: auto_delete_at || null,
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create share" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ id: shareId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
