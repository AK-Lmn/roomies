import { createFileRoute } from "@tanstack/react-router";
import { saveSpotifyOAuthTokens } from "@/lib/server/spotify";

export const Route = createFileRoute("/api/spotify/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const stateRaw = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error || !code || !stateRaw) {
          return new Response(
            `<html><body><script>alert("Spotify authorization failed: ${error || "missing code"}"); window.close();</script></body></html>`,
            { headers: { "Content-Type": "text/html" } },
          );
        }

        let userId = "";
        try {
          const parsed = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8")) as { userId: string };
          userId = parsed.userId;
        } catch {
          return new Response("Invalid state parameter", { status: 400 });
        }

        const clientId = process.env.SPOTIFY_CLIENT_ID?.trim() || "1bad4f22209e471b9c155495dd6f3f30";
        const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim() || "6a00fe79e32046c28af37aa6b4229c1b";
        const origin = new URL(request.url).origin;
        const redirectUri = `${origin}/api/spotify/callback`;

        try {
          const bodyParams = new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
          });

          const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

          const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Authorization": `Basic ${basicAuth}`,
            },
            body: bodyParams,
          });

          if (!tokenRes.ok) {
            const errText = await tokenRes.text();
            console.error("[spotify-callback] token exchange failed:", errText);
            return new Response(`Spotify token exchange failed: ${errText}`, { status: 400 });
          }

          const tokenData = (await tokenRes.json()) as {
            access_token: string;
            refresh_token: string;
            expires_in: number;
          };

          await saveSpotifyOAuthTokens(userId, tokenData.access_token, tokenData.refresh_token, tokenData.expires_in);

          // Success - close popup / redirect back to app
          return new Response(
            `<html><body><script>if(window.opener){window.opener.location.reload(); window.close();} else {window.location.href = "/";}</script><p>Spotify connected successfully! Returning to app...</p></body></html>`,
            { headers: { "Content-Type": "text/html" } },
          );
        } catch (err: unknown) {
          const msg = (err as { message?: string })?.message || "Internal error";
          return new Response(`Error: ${msg}`, { status: 500 });
        }
      },
    },
  },
});
