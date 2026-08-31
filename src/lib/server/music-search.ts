import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";

export interface TrackSearchResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string | null;
  previewUrl: string | null;
  url: string;
}

export interface TrackMetadata {
  title: string;
  artist: string;
  coverUrl: string | null;
}

/**
 * Instant music track search using iTunes public API (fast, reliable, high-res artwork, zero keys required).
 */
export const searchTracks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ query: z.string().min(1).max(100) }))
  .handler(async ({ data }): Promise<TrackSearchResult[]> => {
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(data.query)}&media=music&entity=song&limit=8`;
      const res = await fetch(url, { headers: { "User-Agent": "Roomies/1.0" } });
      if (!res.ok) return [];

      const json = (await res.json()) as {
        results?: Array<{
          trackId: number;
          trackName: string;
          artistName: string;
          collectionName?: string;
          artworkUrl100?: string;
          previewUrl?: string;
          trackViewUrl?: string;
        }>;
      };

      if (!json.results) return [];

      return json.results.map((item) => {
        // Upgrade 100x100 artwork to higher resolution 600x600 if available
        const cover = item.artworkUrl100 ? item.artworkUrl100.replace("100x100bb", "600x600bb") : null;
        const searchYoutubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
          `${item.artistName} - ${item.trackName}`,
        )}`;

        return {
          id: String(item.trackId),
          title: item.trackName,
          artist: item.artistName,
          album: item.collectionName || "",
          coverUrl: cover,
          previewUrl: item.previewUrl || null,
          url: searchYoutubeUrl,
        };
      });
    } catch (err) {
      console.warn("[music-search] search error:", err);
      return [];
    }
  });

/**
 * Smart URL metadata resolver via official Spotify / YouTube oEmbed.
 */
export const fetchTrackMetadata = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ url: z.string().url() }))
  .handler(async ({ data }): Promise<TrackMetadata | null> => {
    try {
      const u = new URL(data.url);

      // Spotify oEmbed
      if (u.hostname.includes("spotify.com")) {
        const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(data.url)}`;
        const res = await fetch(oembedUrl);
        if (res.ok) {
          const info = (await res.json()) as {
            title?: string;
            thumbnail_url?: string;
          };
          if (info.title) {
            // Spotify oEmbed title is often "Track Title - song and lyrics by Artist" or just "Track Title"
            let title = info.title;
            let artist = "Spotify Artist";

            if (title.includes(" - song and lyrics by ")) {
              const parts = title.split(" - song and lyrics by ");
              title = parts[0];
              artist = parts[1] || artist;
            } else if (title.includes(" - song by ")) {
              const parts = title.split(" - song by ");
              title = parts[0];
              artist = parts[1] || artist;
            } else if (title.includes(" by ")) {
              const parts = title.split(" by ");
              title = parts[0];
              artist = parts[1] || artist;
            }

            return {
              title: title.trim(),
              artist: artist.trim(),
              coverUrl: info.thumbnail_url || null,
            };
          }
        }
      }

      // YouTube oEmbed
      if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(data.url)}&format=json`;
        const res = await fetch(oembedUrl);
        if (res.ok) {
          const info = (await res.json()) as {
            title?: string;
            author_name?: string;
            thumbnail_url?: string;
          };
          if (info.title) {
            return {
              title: info.title,
              artist: info.author_name || "YouTube Creator",
              coverUrl: info.thumbnail_url || null,
            };
          }
        }
      }
    } catch (err) {
      console.warn("[music-search] oembed error:", err);
    }

    return null;
  });
