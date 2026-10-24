// Anime embeds probed with curl --max-time 8 on 2026-10-24 for
// The Apothecary Diaries Season 3 episode 2 (MAL 61987, AniList 195516).
// Kept: HTTP 200 text/html, no X-Frame-Options deny.
//   VidCloud  https://vidcloud.sbs/embed/mal/61987/2/sub
//             title was "The Apothecary Diaries Season 3 - Episode 2 | VidCloud"
//   VidLink   https://vidlink.pro/anime/61987/2/sub?fallback=true
//   Videasy   https://player.videasy.to/anime/61987/2
//   VidSrc    https://vidsrc.me/embed/anime/mal/61987/2
//             answers 200, then the player says the media is unavailable
// Skipped: DNS failures, and HTTP 403 (vidsrc.cc is a Cloudflare challenge).

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

export function animeEmbedOptions({ malId, anilistId, episode } = {}) {
  const ep = positiveInteger(episode);
  const mal = positiveInteger(malId);
  const ani = positiveInteger(anilistId);
  if (!ep) return [];

  const hosts = [
    {
      id: "vidcloud",
      label: "VidCloud",
      url: mal
        ? `https://vidcloud.sbs/embed/mal/${mal}/${ep}/sub`
        : ani
          ? `https://vidcloud.sbs/embed/ani/${ani}/${ep}/sub`
          : "",
    },
    {
      id: "vidlink",
      label: "VidLink",
      url: mal ? `https://vidlink.pro/anime/${mal}/${ep}/sub?fallback=true` : "",
    },
    {
      id: "videasy",
      label: "Videasy",
      url: mal ? `https://player.videasy.to/anime/${mal}/${ep}` : "",
    },
    {
      id: "vidsrc",
      label: "VidSrc",
      url: mal ? `https://vidsrc.me/embed/anime/mal/${mal}/${ep}` : "",
    },
  ];
  return hosts.filter((host) => host.url);
}

export function firstAnimeEmbed(options, preferredId = "") {
  const list = Array.isArray(options) ? options : [];
  const preferred = list.find((host) => host.id === preferredId && host.url);
  if (preferred) return preferred;
  const start = preferredId ? list.findIndex((host) => host.id === preferredId) : -1;
  const rest = start >= 0 ? list.slice(start + 1).concat(list.slice(0, start)) : list;
  return rest.find((host) => host.url) || null;
}
