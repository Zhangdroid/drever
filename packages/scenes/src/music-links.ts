export type MusicProvider = "apple-music" | "spotify";

export type MusicEmbed = Readonly<{
  embedUrl: string;
  openUrl: string;
  provider: MusicProvider;
}>;

const SPOTIFY_TYPES = new Set(["album", "artist", "episode", "playlist", "show", "track"]);

/** Resolves official Spotify and Apple Music links without loading either provider. */
export const resolveMusicEmbed = (value: string): MusicEmbed | undefined => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }

  if (url.protocol !== "https:") {
    return undefined;
  }

  if (url.hostname === "open.spotify.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const offset = parts[0] === "embed" ? 1 : 0;
    const type = parts[offset];
    const id = parts[offset + 1];
    if (type === undefined || id === undefined || !SPOTIFY_TYPES.has(type)) {
      return undefined;
    }

    return Object.freeze({
      embedUrl: `https://open.spotify.com/embed/${type}/${id}`,
      openUrl: `https://open.spotify.com/${type}/${id}`,
      provider: "spotify",
    });
  }

  if (url.hostname === "music.apple.com" || url.hostname === "embed.music.apple.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 3) {
      return undefined;
    }

    const path = `/${parts.join("/")}`;
    const item = url.searchParams.get("i");
    const search = item === null ? "" : `?i=${item}`;
    return Object.freeze({
      embedUrl: `https://embed.music.apple.com${path}${search}`,
      openUrl: `https://music.apple.com${path}${search}`,
      provider: "apple-music",
    });
  }

  return undefined;
};
