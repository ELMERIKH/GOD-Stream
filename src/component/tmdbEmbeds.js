// Embeds probed from this environment (HTTP 200, text/html):
// VidSrc https://v2.vidsrc.me/embed/{imdb}
// 2Embed https://2embed.org/embed/{imdb}
// 2Embed CC https://www.2embed.cc/embed/{imdb}
// VidLink https://vidlink.pro/movie/{tmdb}
// AutoEmbed https://autoembed.co/movie/imdb/{imdb}
// TV uses the same hosts. VidLink's IMDB TV path returns 500, so TV VidLink keeps the TMDB id.

const TMDB_KEY = "152f41397d36a9af171b938124f0281c";

export const STREAM_SOURCES = [
  { id: "vidsrc", label: "VidSrc" },
  { id: "2embed", label: "2Embed" },
  { id: "2embedcc", label: "2Embed CC" },
  { id: "vidlink", label: "VidLink" },
  { id: "autoembed", label: "AutoEmbed" },
];

export function tmdbUrl(path) {
  const join = path.includes("?") ? "&" : "?";
  return `https://api.themoviedb.org/3${path}${join}api_key=${TMDB_KEY}`;
}

export function movieEmbed(sourceId, { imdb, tmdb } = {}) {
  switch (sourceId) {
    case "vidsrc":
      return imdb ? `https://v2.vidsrc.me/embed/${imdb}` : "";
    case "2embed":
      return imdb ? `https://2embed.org/embed/${imdb}` : "";
    case "2embedcc":
      return imdb ? `https://www.2embed.cc/embed/${imdb}` : "";
    case "vidlink":
      return tmdb ? `https://vidlink.pro/movie/${tmdb}` : "";
    case "autoembed":
      return imdb ? `https://autoembed.co/movie/imdb/${imdb}` : "";
    default:
      return "";
  }
}

export function tvEmbed(sourceId, { imdb, tmdb, season, episode } = {}) {
  const seasonNumber = Number(season) || 1;
  const episodeNumber = Number(episode) || 1;
  switch (sourceId) {
    case "vidsrc":
      return imdb ? `https://v2.vidsrc.me/embed/${imdb}/${seasonNumber}/${episodeNumber}` : "";
    case "2embed":
      return imdb ? `https://2embed.org/embed/${imdb}/${seasonNumber}/${episodeNumber}` : "";
    case "2embedcc":
      return imdb ? `https://www.2embed.cc/embedtv/${imdb}&s=${seasonNumber}&e=${episodeNumber}` : "";
    case "vidlink":
      return tmdb ? `https://vidlink.pro/tv/${tmdb}/${seasonNumber}/${episodeNumber}` : "";
    case "autoembed":
      return imdb ? `https://autoembed.co/tv/imdb/${imdb}-${seasonNumber}-${episodeNumber}` : "";
    default:
      return "";
  }
}

export function youtubeEmbed(videoKey) {
  return videoKey ? `https://www.youtube-nocookie.com/embed/${videoKey}` : "";
}
