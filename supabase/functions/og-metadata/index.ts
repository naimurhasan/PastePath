import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function escapeHtml(text: string): string {
  if (!text) return "";
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const shareId = url.searchParams.get("id");

    if (!shareId) {
      return new Response("Missing id parameter", { status: 400 });
    }

    // Call the read-only RPC to get metadata (no password check, no view increment)
    const { data, error } = await supabase.rpc("get_share_metadata", {
      p_id: shareId,
    });

    if (error) {
      console.error("RPC error:", error);
      return new Response(
        `<!DOCTYPE html>
        <html>
          <head>
            <meta property="og:title" content="Share Not Found" />
            <meta property="og:description" content="This share is no longer available." />
          </head>
          <body>Share not found</body>
        </html>`,
        {
          headers: { ...corsHeaders, "Content-Type": "text/html" },
          status: 404,
        }
      );
    }

    // Check if we got a result
    if (!data || data.length === 0 || !data[0]) {
      return new Response(
        `<!DOCTYPE html>
        <html>
          <head>
            <meta property="og:title" content="Share Not Found" />
            <meta property="og:description" content="This share is no longer available." />
          </head>
          <body>Share not found</body>
        </html>`,
        {
          headers: { ...corsHeaders, "Content-Type": "text/html" },
          status: 404,
        }
      );
    }

    const share = data[0];

    // Check if deleted or expired
    if (share.deleted_at || (share.auto_delete_at && new Date(share.auto_delete_at) <= new Date())) {
      return new Response(
        `<!DOCTYPE html>
        <html>
          <head>
            <meta property="og:title" content="Share Expired" />
            <meta property="og:description" content="This share has expired or been deleted." />
          </head>
          <body>Share expired</body>
        </html>`,
        {
          headers: { ...corsHeaders, "Content-Type": "text/html" },
          status: 410,
        }
      );
    }

    // Create OG meta tags
    const shareTitle = share.title || "Shared Image";
    const siteUrl = Deno.env.get("SITE_URL") || "https://pastepath.com";
    const viewUrl = `${siteUrl}/view/${shareId}`;
    const ogHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta property="og:title" content="${escapeHtml(shareTitle)}" />
    <meta property="og:description" content="View this shared annotation from PastePath" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(viewUrl)}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(shareTitle)}" />
    <meta name="twitter:description" content="View this shared annotation from PastePath" />
    <meta name="description" content="${escapeHtml(shareTitle)}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(shareTitle)}</title>
    <script>
      window.location.href = '${viewUrl}';
    </script>
  </head>
  <body>
    <p>Redirecting to share...</p>
  </body>
</html>`;

    return new Response(ogHtml, {
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
  }
});
