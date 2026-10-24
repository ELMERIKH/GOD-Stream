// Live sources probed from this environment:
// AniList, Kitsu, and MangaDex: titles, covers, and (MangaDex) chapter pages. Browser CORS.
// Consumet https://consumet-api-m8mf.onrender.com : MangaPill search/info/read return
// chapter image URLs (JPEG 200). Gogoanime search is an empty list. Zoro and AnimePahe
// return HTTP 500. Used for manga pages and a fail-fast episode lookup, never the grid.
// Shikimori https://shikimori.io/api : CORS *, YouTube trailer/opening embeds.
// Sanka https://www.sankavollerei.web.id : CORS *. Anime episode servers and
// Komikstation/Kiryuu chapter images. DesuStream frames are blocked; Filedon embeds load.
// Not wired: AnimePahe (the public search answers with an anti-bot HTML page, and the
// published API says it is waiting on a Cloudflare UAM fix — no bypass is included).
// Fetch-Stream https://fetch-stream.vercel.app returns Vercel DEPLOYMENT_NOT_FOUND.
// Jikan, MangaMint, CopyManga, sankanime.web.id, HiAnime, AllAnime, and Crunchyroll
// did not return a usable public response.

const ANILIST = "https://graphql.anilist.co";
const SANKA = "https://www.sankavollerei.web.id";
const KITSU = "https://kitsu.io/api/edge";
const MANGADEX = "https://api.mangadex.org";
const CONSUMET = "https://consumet-api-m8mf.onrender.com";
const SHIKIMORI = "https://shikimori.io/api";
const KITSU_ACCEPT = "application/vnd.api+json";
const CACHE_KEY = "streamgod.catalog.v2";
const HTTP_KEY = "streamgod.http.v2";
const REQUEST_TIMEOUT = 4000;
const LIST_TTL = 10 * 60 * 1000;
const DETAIL_TTL = 30 * 60 * 1000;

const memoryCache = new Map();
const responseMemory = new Map();
const inflight = new Map();

export const POSTER_PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
      <rect width="400" height="600" fill="#141416"/>
      <text x="200" y="300" fill="#e11d48" font-family="sans-serif" font-size="28" text-anchor="middle">No cover</text>
    </svg>`
  );

export function onPosterError(event) {
  const image = event.currentTarget;
  if (image.dataset.fallback === "1") return;
  image.dataset.fallback = "1";
  image.src = POSTER_PLACEHOLDER;
}

export function sourceLabel(source) {
  return (
    {
      anilist: "AniList",
      kitsu: "Kitsu",
      mangadex: "MangaDex",
      sanka: "Sanka",
      kiryuu: "Kiryuu",
      komikstation: "Komikstation",
      mangapill: "MangaPill",
      shikimori: "Shikimori",
    }[source] || source || "Catalog"
  );
}

export function parseCatalogId(id) {
  const value = safeDecode(String(id || ""));
  const splitAt = value.indexOf(":");
  if (splitAt <= 0) return { source: "", raw: value, id: value };
  const source = value.slice(0, splitAt);
  const raw = value.slice(splitAt + 1);
  return { source, raw, id: `${source}:${raw}` };
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function plainText(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compactTitle(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function sameWork(left, right) {
  const a = compactTitle(left);
  const b = compactTitle(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function titleRank(wanted, found) {
  const a = compactTitle(wanted);
  const b = compactTitle(found);
  if (!a || !b) return 0;
  if (b.includes("novel") && !a.includes("novel")) return 0;
  if (a === b) return 100;
  if (b.startsWith(a) && b.length - a.length <= 16) return 90;
  if (a.startsWith(b) && a.length - b.length <= 16) return 85;
  return 0;
}

function bestTitleMatch(title, rows, readTitle) {
  let best = null;
  let bestScore = 0;
  rows.forEach((row) => {
    const score = titleRank(title, readTitle(row));
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  });
  return bestScore >= 80 ? best : null;
}

function youtubeId(url) {
  const match = String(url || "").match(/(?:youtu\.be\/|embed\/|v=|shorts\/)([A-Za-z0-9_-]{6,})/);
  return match ? match[1] : "";
}

function youtubeEmbed(id) {
  return `https://www.youtube-nocookie.com/embed/${id}`;
}

function remember(items) {
  const stored = {};
  items.forEach((item) => {
    if (!item?.id) return;
    const saved = {
      id: item.id,
      source: item.source,
      title: item.title,
      image: item.image || "",
      rating: item.rating ?? null,
      description: item.description || "",
    };
    memoryCache.set(item.id, saved);
    stored[item.id] = saved;
  });
  try {
    const previous = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "{}");
    const next = { ...previous, ...stored };
    const keys = Object.keys(next);
    if (keys.length > 240) {
      keys.slice(0, keys.length - 240).forEach((key) => delete next[key]);
    }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {
    // sessionStorage can be unavailable in private browsing.
  }
}

function recall(id) {
  if (memoryCache.has(id)) return memoryCache.get(id);
  try {
    const previous = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "{}");
    return previous[id] || null;
  } catch {
    return null;
  }
}

function readHttp(key) {
  try {
    const all = JSON.parse(sessionStorage.getItem(HTTP_KEY) || "{}");
    const row = all[key];
    if (!row || row.exp < Date.now()) return null;
    return row.value;
  } catch {
    return null;
  }
}

function writeHttp(key, value, ttl) {
  try {
    const all = JSON.parse(sessionStorage.getItem(HTTP_KEY) || "{}");
    all[key] = { exp: Date.now() + ttl, value };
    const keys = Object.keys(all);
    if (keys.length > 40) {
      keys.slice(0, keys.length - 40).forEach((stale) => delete all[stale]);
    }
    sessionStorage.setItem(HTTP_KEY, JSON.stringify(all));
  } catch {
    // Quota and private mode keep the in-memory copy.
  }
}

function cached(key, loader, ttl = LIST_TTL) {
  const now = Date.now();
  const mem = responseMemory.get(key);
  if (mem && mem.exp > now) return Promise.resolve(mem.value);

  const stored = readHttp(key);
  if (stored != null) {
    responseMemory.set(key, { exp: now + ttl, value: stored });
    return Promise.resolve(stored);
  }

  if (inflight.has(key)) return inflight.get(key);

  const promise = Promise.resolve()
    .then(loader)
    .then((value) => {
      const empty = Array.isArray(value) ? value.length === 0 : value?.items?.length === 0;
      const keep = empty ? Math.min(ttl, 90 * 1000) : ttl;
      responseMemory.set(key, { exp: Date.now() + keep, value });
      writeHttp(key, value, keep);
      inflight.delete(key);
      return value;
    })
    .catch((error) => {
      inflight.delete(key);
      throw error;
    });

  inflight.set(key, promise);
  return promise;
}

async function fetchJson(url, options = {}) {
  const timeout = options.timeout || REQUEST_TIMEOUT;
  const request = { ...options };
  delete request.timeout;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...request,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(request.headers || {}),
      },
    });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function firstList(calls) {
  let sawSuccess = false;
  let lastError = null;
  for (const call of calls) {
    try {
      const result = await call();
      sawSuccess = true;
      if (result?.items?.length) {
        remember(result.items);
        return result;
      }
    } catch (error) {
      lastError = error;
    }
  }
  if (!sawSuccess && lastError) throw lastError;
  return { items: [], hasNext: false, source: "" };
}

function anilistTitle(media) {
  return media?.title?.english || media?.title?.romaji || "Untitled";
}

function anilistItem(media, sourceType) {
  const nextEpisode = media?.nextAiringEpisode?.episode;
  return {
    id: `anilist:${media.id}`,
    source: "anilist",
    title: anilistTitle(media),
    image: media?.coverImage?.extraLarge || media?.coverImage?.large || "",
    rating: media?.averageScore ?? null,
    description: plainText(media?.description),
    episodeNumber: media?.episodes || null,
    nextEpisode: nextEpisode || null,
    kind: sourceType === "MANGA" ? "manga" : "anime",
  };
}

async function anilistPage({ type, page, sort, status, search }) {
  const filters = ["type: $type", "sort: $sort", "isAdult: false"];
  const definitions = ["$page: Int", "$perPage: Int", "$sort: [MediaSort]", "$type: MediaType"];
  const variables = { page, perPage: 20, sort: [sort], type };
  if (status) {
    filters.push("status: $status");
    definitions.push("$status: MediaStatus");
    variables.status = status;
  }
  if (search) {
    filters.push("search: $search");
    definitions.push("$search: String");
    variables.search = search;
  }
  const query = `query (${definitions.join(", ")}) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage }
      media(${filters.join(", ")}) {
        id
        title { romaji english }
        coverImage { large extraLarge }
        averageScore
        description(asHtml: false)
        episodes
        chapters
        nextAiringEpisode { episode }
      }
    }
  }`;
  const payload = await fetchJson(ANILIST, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (payload.errors?.length && !payload.data?.Page) {
    throw new Error(payload.errors[0].message || "AniList failed");
  }
  const media = payload.data?.Page?.media || [];
  return {
    items: media.map((entry) => anilistItem(entry, type)),
    hasNext: Boolean(payload.data?.Page?.pageInfo?.hasNextPage),
    source: "anilist",
  };
}

function kitsuImage(image) {
  if (!image) return "";
  if (typeof image === "string") return image;
  return image.medium || image.large || image.small || image.original || image.tiny || "";
}

function kitsuItem(resource, kind) {
  const attributes = resource.attributes || {};
  return {
    id: `kitsu:${resource.id}`,
    source: "kitsu",
    title: attributes.canonicalTitle || attributes.titles?.en || attributes.slug || "Untitled",
    image: kitsuImage(attributes.posterImage),
    rating: attributes.averageRating ? Math.round(Number(attributes.averageRating)) : null,
    description: plainText(attributes.synopsis || attributes.description),
    episodeNumber: attributes.episodeCount || attributes.chapterCount || null,
    kind,
  };
}

async function kitsuCollection(path, kind) {
  const payload = await fetchJson(`${KITSU}${path}`, {
    headers: { Accept: KITSU_ACCEPT },
  });
  return {
    items: (payload.data || []).map((resource) => kitsuItem(resource, kind)),
    hasNext: Boolean(payload.links?.next),
    source: "kitsu",
  };
}

function kitsuListPath(kind, preset, page) {
  const params = new URLSearchParams();
  params.set("page[limit]", "20");
  params.set("page[offset]", String((page - 1) * 20));
  if (preset === "recent") {
    params.set("filter[status]", "current");
    params.set("sort", "-userCount");
  } else if (preset === "trending") {
    params.set("sort", "-averageRating");
  } else {
    params.set("sort", "-userCount");
  }
  return `/${kind}?${params.toString()}`;
}

async function anilistDetail(rawId, type) {
  const query = `query ($id: Int, $type: MediaType) {
    Media(id: $id, type: $type) {
      id
      title { romaji english }
      description(asHtml: false)
      coverImage { extraLarge large }
      averageScore
      idMal
      episodes
      chapters
      status
      trailer { id site }
      streamingEpisodes { title thumbnail url site }
    }
  }`;
  const payload = await fetchJson(ANILIST, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { id: Number(rawId), type },
    }),
  });
  const media = payload.data?.Media;
  if (!media) {
    throw new Error(payload.errors?.[0]?.message || "AniList title was not found");
  }
  const item = anilistItem(media, type);
  const trailer = media.trailer;
  const trailerId = trailer && String(trailer.site || "").toLowerCase() === "youtube" ? trailer.id : "";
  const streamed = (media.streamingEpisodes || []).map((episode, index) => ({
    number: index + 1,
    title: episode.title || `Episode ${index + 1}`,
    url: episode.url ? episode.url.replace(/^http:\/\//i, "https://") : "",
    site: episode.site || "",
    thumbnail: episode.thumbnail || "",
  }));
  const episodeTotal = Number(media.episodes) || streamed.length;
  const episodes = streamed.length
    ? streamed
    : Array.from({ length: Math.min(episodeTotal, 80) }, (_, index) => ({
        number: index + 1,
        title: `Episode ${index + 1}`,
        url: "",
        site: "",
        thumbnail: "",
      }));
  const chapterTotal = Number(media.chapters) || 0;
  const detail = {
    ...item,
    malId: media.idMal || null,
    preview: trailerId ? { label: "Trailer", embed: youtubeEmbed(trailerId) } : null,
    episodes,
    chapters:
      type === "MANGA"
        ? Array.from({ length: Math.min(chapterTotal, 80) }, (_, index) => ({
            id: "",
            number: index + 1,
            title: `Chapter ${index + 1}`,
            pages: 0,
          }))
        : [],
    notice:
      type === "ANIME" && !streamed.length
        ? "No playable stream is listed for this title. The episode list is still shown."
        : type === "MANGA"
          ? "AniList has the catalog entry, not chapter pages."
          : "",
  };
  remember([detail]);
  return detail;
}

async function kitsuAnimeDetail(rawId) {
  const payload = await fetchJson(`${KITSU}/anime/${rawId}`, {
    headers: { Accept: KITSU_ACCEPT },
  });
  if (!payload.data) throw new Error("Kitsu title was not found");
  const item = kitsuItem(payload.data, "anime");
  const episodes = [];
  const page = await fetchJson(
    `${KITSU}/anime/${rawId}/episodes?page[limit]=20&sort=number`,
    { headers: { Accept: KITSU_ACCEPT } }
  );
  (page.data || []).forEach((episode) => {
    const attributes = episode.attributes || {};
    episodes.push({
      number: attributes.number || episodes.length + 1,
      title: attributes.canonicalTitle || `Episode ${attributes.number || episodes.length + 1}`,
      url: "",
      site: "",
      thumbnail: kitsuImage(attributes.thumbnail),
    });
  });
  if (!episodes.length && item.episodeNumber) {
    const total = Math.min(Number(item.episodeNumber) || 0, 80);
    for (let number = 1; number <= total; number += 1) {
      episodes.push({ number, title: `Episode ${number}`, url: "", site: "", thumbnail: "" });
    }
  }
  const detail = {
    ...item,
    episodes,
    chapters: [],
    notice: episodes.some((episode) => episode.url)
      ? ""
      : "Kitsu has no embeddable stream for this title. Poster, description, and episodes are shown.",
  };
  remember([detail]);
  return detail;
}

async function kitsuMangaDetail(rawId) {
  const payload = await fetchJson(`${KITSU}/manga/${rawId}`, {
    headers: { Accept: KITSU_ACCEPT },
  });
  if (!payload.data) throw new Error("Kitsu manga was not found");
  const item = kitsuItem(payload.data, "manga");
  const chapters = [];
  const page = await fetchJson(
    `${KITSU}/manga/${rawId}/chapters?page[limit]=20&sort=number`,
    { headers: { Accept: KITSU_ACCEPT } }
  );
  (page.data || []).forEach((chapter) => {
    const attributes = chapter.attributes || {};
    const number = attributes.number || chapters.length + 1;
    chapters.push({
      id: "",
      number,
      title: attributes.canonicalTitle || `Chapter ${number}`,
      pages: 0,
    });
  });
  const detail = {
    ...item,
    episodes: [],
    chapters,
    notice: "Kitsu lists chapters, but page images come from MangaDex when that source is available.",
  };
  remember([detail]);
  return detail;
}

function mdUrl(path, pairs) {
  const params = new URLSearchParams();
  pairs.forEach(([key, value]) => params.append(key, value));
  return `${MANGADEX}${path}?${params.toString()}`;
}

function mdTitle(attributes) {
  const title = attributes?.title || {};
  if (title.en) return title.en;
  const english = (attributes?.altTitles || []).find((item) => item.en);
  if (english?.en) return english.en;
  return title["ja-ro"] || title["ko-ro"] || title.ja || Object.values(title)[0] || "Untitled";
}

function mdCover(manga) {
  const cover = (manga.relationships || []).find((relationship) => relationship.type === "cover_art");
  const fileName = cover?.attributes?.fileName;
  if (!fileName) return "";
  return `https://uploads.mangadex.org/covers/${manga.id}/${fileName}.256.jpg`;
}

function mdItem(manga) {
  return {
    id: `mangadex:${manga.id}`,
    source: "mangadex",
    title: mdTitle(manga.attributes),
    image: mdCover(manga),
    rating: null,
    description: plainText(
      manga.attributes?.description?.en ||
        Object.values(manga.attributes?.description || {})[0] ||
        ""
    ),
    episodeNumber: null,
    kind: "manga",
  };
}

async function mangadexList(page, title) {
  const pairs = [
    ["limit", "20"],
    ["offset", String((page - 1) * 20)],
    ["includes[]", "cover_art"],
    ["contentRating[]", "safe"],
    ["contentRating[]", "suggestive"],
    ["availableTranslatedLanguage[]", "en"],
  ];
  if (title) {
    pairs.push(["title", title], ["order[relevance]", "desc"]);
  } else {
    pairs.push(["hasAvailableChapters", "true"], ["order[latestUploadedChapter]", "desc"]);
  }
  const payload = await fetchJson(mdUrl("/manga", pairs));
  if (payload.result !== "ok") throw new Error("MangaDex list failed");
  const items = (payload.data || []).map(mdItem).filter((item) => item.title);
  const total = Number(payload.total) || 0;
  return {
    items,
    hasNext: page * 20 < total,
    source: "mangadex",
  };
}

async function mangadexChapters(mangaId) {
  const load = async (language) => {
    const pairs = [
      ["limit", "100"],
      ["offset", "0"],
      ["order[volume]", "asc"],
      ["order[chapter]", "asc"],
      ["includeFuturePublishAt", "0"],
      ["contentRating[]", "safe"],
      ["contentRating[]", "suggestive"],
      ["includeExternalUrl", "0"],
    ];
    if (language) pairs.push(["translatedLanguage[]", language]);
    const payload = await fetchJson(mdUrl(`/manga/${mangaId}/feed`, pairs));
    return payload.data || [];
  };
  let data = await load("en");
  if (!data.length) data = await load("");
  const byNumber = new Map();
  data.forEach((chapter) => {
    const attributes = chapter.attributes || {};
    if (attributes.externalUrl || !Number(attributes.pages)) return;
    const number = attributes.chapter || "";
    const entry = {
      id: chapter.id,
      number: number || byNumber.size + 1,
      title: attributes.title
        ? `Chapter ${number || "?"} — ${attributes.title}`
        : `Chapter ${number || "?"}`,
      pages: Number(attributes.pages) || 0,
    };
    const key = String(number || chapter.id);
    const previous = byNumber.get(key);
    if (!previous || entry.pages > previous.pages) byNumber.set(key, entry);
  });
  return [...byNumber.values()];
}

async function mangadexDetail(rawId) {
  const payload = await fetchJson(
    mdUrl(`/manga/${rawId}`, [
      ["includes[]", "cover_art"],
    ])
  );
  if (!payload.data) throw new Error("MangaDex title was not found");
  const item = mdItem(payload.data);
  let chapters = [];
  let notice = "";
  try {
    chapters = await mangadexChapters(rawId);
    if (!chapters.length) notice = "MangaDex returned this title without a chapter list.";
    else if (!chapters.some((chapter) => chapter.pages > 0)) {
      notice = "Chapters are listed, but this title has no page images on MangaDex right now.";
    }
  } catch {
    notice = "The chapter list could not be loaded. The cover and description are still shown.";
  }
  const detail = { ...item, episodes: [], chapters, notice };
  remember([detail]);
  return detail;
}

export function clearCatalogCache() {
  responseMemory.clear();
  inflight.clear();
  memoryCache.clear();
  try {
    sessionStorage.removeItem(HTTP_KEY);
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // sessionStorage can be unavailable in private browsing.
  }
}

function pickPlayableServer(server) {
  const preferred = ["filedon", "vidhide", "mega", "blogs"];
  const all = [];
  (server?.qualities || []).forEach((quality) => {
    (quality.serverList || []).forEach((entry) => all.push(entry));
  });
  return [...all].sort((left, right) => {
    const rank = (entry) => {
      const name = String(entry.title || "").toLowerCase();
      const index = preferred.findIndex((token) => name.includes(token));
      return index === -1 ? preferred.length : index;
    };
    return rank(left) - rank(right);
  })[0] || null;
}

export function loadEpisodeEmbed(episodeId) {
  if (!episodeId) return Promise.resolve("");
  return cached(`sanka:embed:${episodeId}`, async () => {
    const episode = await fetchJson(`${SANKA}/anime/episode/${encodeURIComponent(episodeId)}`);
    const server = pickPlayableServer(episode?.data?.server);
    if (server?.serverId) {
      const resolved = await fetchJson(`${SANKA}/anime/server/${encodeURIComponent(server.serverId)}`);
      if (resolved?.data?.url) return resolved.data.url;
    }
    return episode?.data?.defaultStreamingUrl || "";
  }, 10 * 60 * 1000);
}

export function getMangaPages(chapterId) {
  if (!chapterId) return Promise.resolve([]);
  if (String(chapterId).startsWith("komikstation:")) {
    const slug = String(chapterId).slice("komikstation:".length);
    return cached(`ks:pages:${slug}`, async () => {
      const payload = await fetchJson(`${SANKA}/comic/komikstation/chapter/${encodeURIComponent(slug)}`, {
        timeout: 8000,
      });
      return Array.isArray(payload?.images) ? payload.images : [];
    }, 8 * 60 * 1000);
  }
  if (String(chapterId).startsWith("mangapill:")) {
    const raw = String(chapterId).slice("mangapill:".length);
    return cached(`mp:pages:${raw}`, async () => {
      const payload = await fetchJson(
        `${CONSUMET}/manga/mangapill/read?chapterId=${encodeURIComponent(raw)}`,
        { timeout: 8000 }
      );
      const rows = Array.isArray(payload) ? payload : [];
      return rows.map((row) => row.img).filter(Boolean);
    }, 8 * 60 * 1000);
  }
  return cached(`md:pages:${chapterId}`, async () => {
    const payload = await fetchJson(`${MANGADEX}/at-home/server/${chapterId}`, { timeout: 5000 });
    const chapter = payload.chapter || {};
    const saver = chapter.dataSaver || [];
    const files = saver.length ? saver : chapter.data || [];
    const mode = saver.length ? "data-saver" : "data";
    if (!payload.baseUrl || !chapter.hash || !files.length) return [];
    return files.map((file) => `${payload.baseUrl}/${mode}/${chapter.hash}/${file}`);
  }, 8 * 60 * 1000);
}

async function fallbackDetail(parsed, cached, search, loaders) {
  if (cached?.title) {
    try {
      const found = await search(cached.title, 1);
      const alternate = found.items.find(
        (item) => item.source !== parsed.source && sameWork(item.title, cached.title)
      );
      if (alternate && loaders[alternate.source]) {
        const detail = await loaders[alternate.source](parseCatalogId(alternate.id).raw);
        return {
          ...detail,
          notice: `Loaded from ${sourceLabel(detail.source)} because ${sourceLabel(parsed.source)} did not respond.`,
        };
      }
    } catch {
      // The alternate catalog failed too. Fall through to the cached card.
    }
  }
  if (cached) {
    return {
      ...cached,
      episodes: [],
      chapters: [],
      notice: `${sourceLabel(parsed.source)} did not respond. Showing the saved poster and description.`,
    };
  }
  return null;
}

async function sankaAnimeList(page) {
  if (page > 1) return { items: [], hasNext: false, source: "sanka" };
  const payload = await fetchJson(`${SANKA}/anime/home`);
  const rows = [
    ...(payload.data?.ongoing?.animeList || []),
    ...(payload.data?.completed?.animeList || []),
  ].slice(0, 20);
  return {
    items: rows.filter((row) => row.animeId).map((row) => ({
      id: `sanka:${row.animeId}`,
      source: "sanka",
      title: row.title,
      image: row.poster || "",
      rating: null,
      episodeNumber: row.episodes || null,
      kind: "anime",
    })),
    hasNext: true,
    source: "sanka",
  };
}

async function sankaSearch(query) {
  const payload = await fetchJson(`${SANKA}/anime/search/${encodeURIComponent(query)}`);
  const rows = payload.data?.animeList || [];
  return {
    items: rows.filter((row) => row.animeId).map((row) => ({
      id: `sanka:${row.animeId}`,
      source: "sanka",
      title: row.title,
      image: row.poster || "",
      rating: row.score ? Number(row.score) : null,
      kind: "anime",
    })),
    hasNext: false,
    source: "sanka",
  };
}

async function sankaAnimeDetail(slug) {
  const payload = await fetchJson(`${SANKA}/anime/anime/${encodeURIComponent(slug)}`);
  const data = payload.data;
  if (!data?.title) throw new Error("Sanka title was not found");
  const synopsis = Array.isArray(data.synopsis?.paragraphs)
    ? data.synopsis.paragraphs.join("\n\n")
    : "";
  const episodes = (data.episodeList || [])
    .map((episode) => ({
      number: Number(episode.eps) || 0,
      title: `Episode ${episode.eps}`,
      episodeId: episode.episodeId,
      url: "",
      site: "Sanka",
      thumbnail: "",
    }))
    .filter((episode) => episode.episodeId)
    .sort((left, right) => left.number - right.number);
  const detail = {
    id: `sanka:${slug}`,
    source: "sanka",
    title: data.title,
    image: data.poster || "",
    rating: data.score ? Number(data.score) : null,
    description: plainText(synopsis),
    episodes,
    chapters: [],
    notice: episodes.length ? "Choose an episode to load a player." : "",
    kind: "anime",
  };
  remember([detail]);
  return detail;
}

function playableTitle(wanted, found) {
  const strip = (value) => compactTitle(
    String(value || "")
      .replace(/subtitle indonesia/ig, "")
      .replace(/\(episode[^)]*\)/ig, "")
  );
  const left = strip(wanted);
  const right = strip(found);
  return Boolean(left) && left === right;
}

async function attachPreview(detail) {
  if (!detail || detail.preview?.embed) return detail;
  try {
    let malId = detail.malId;
    if (!malId && detail.title) {
      const found = await fetchJson(
        `${SHIKIMORI}/animes?search=${encodeURIComponent(detail.title)}&limit=5`,
        { timeout: 3500 }
      );
      const row = (Array.isArray(found) ? found : []).find((item) => playableTitle(detail.title, item.name));
      malId = row?.id || null;
    }
    if (!malId) return detail;
    const videos = await fetchJson(`${SHIKIMORI}/animes/${malId}/videos`, { timeout: 3500 });
    const rank = { pv: 0, op: 1, ed: 2, other: 3 };
    const picked = (Array.isArray(videos) ? videos : [])
      .filter((video) => video.hosting === "youtube" && youtubeId(video.player_url || video.url))
      .sort((left, right) => (rank[left.kind] ?? 9) - (rank[right.kind] ?? 9))[0];
    if (!picked) return detail;
    const kindLabel = { pv: "Trailer", op: "Opening", ed: "Ending", other: "Preview" }[picked.kind] || "Preview";
    return {
      ...detail,
      malId,
      preview: {
        label: picked.name ? `${kindLabel}: ${picked.name}` : kindLabel,
        embed: youtubeEmbed(youtubeId(picked.player_url || picked.url)),
      },
    };
  } catch {
    return detail;
  }
}

async function attachPlayableEpisodes(detail) {
  if (!detail?.title || detail.source === "sanka") return detail;
  if ((detail.episodes || []).some((episode) => episode.episodeId)) return detail;
  try {
    const found = await sankaSearch(detail.title);
    const hit = found.items.find((item) => playableTitle(detail.title, item.title));
    if (!hit) return detail;
    const playable = await sankaAnimeDetail(parseCatalogId(hit.id).raw);
    if (!playable?.episodes?.length) return detail;
    return {
      ...detail,
      episodes: playable.episodes,
      notice: "Playback comes from Sanka. Poster and description stay with the catalog source.",
    };
  } catch {
    return detail;
  }
}

async function kiryuuList(page) {
  if (page > 1) return { items: [], hasNext: false, source: "kiryuu" };
  const payload = await fetchJson(`${SANKA}/comic/kiryuu/home`);
  const rows = payload.trending || payload.data?.trending || [];
  return {
    items: rows.filter((row) => row.slug && row.imageSrc && !String(row.imageSrc).startsWith("data:")).map((row) => ({
      id: `kiryuu:${row.slug}`,
      source: "kiryuu",
      title: row.title,
      image: row.imageSrc,
      rating: row.rating ? Number(row.rating) : null,
      kind: "manga",
    })),
    hasNext: true,
    source: "kiryuu",
  };
}

async function kiryuuSearch(query) {
  const payload = await fetchJson(`${SANKA}/comic/kiryuu/search/${encodeURIComponent(query)}`);
  const rows = payload.seriesList || [];
  return {
    items: rows.filter((row) => row.slug).map((row) => ({
      id: `kiryuu:${row.slug}`,
      source: "kiryuu",
      title: row.title,
      image: row.image || "",
      rating: row.rating ? Number(row.rating) : null,
      kind: "manga",
    })),
    hasNext: false,
    source: "kiryuu",
  };
}

async function komikstationDetail(slug) {
  const payload = await fetchJson(`${SANKA}/comic/komikstation/manga/${encodeURIComponent(slug)}`, {
    timeout: 8000,
  });
  if (!payload?.title || !payload?.chapters?.length) return null;
  const latest = payload.chapters.slice(0, 80);
  const chapters = latest.map((chapter) => ({
    id: `komikstation:${chapter.slug}`,
    number: chapter.title,
    title: String(chapter.title || "Chapter").replace(/\s+/g, " ").trim(),
    pages: 1,
  }));
  return {
    id: `komikstation:${slug}`,
    source: "komikstation",
    title: payload.title,
    image: payload.imageSrc || "",
    rating: payload.rating ? Number(payload.rating) : null,
    description: plainText(payload.synopsis),
    episodes: [],
    chapters,
    notice: payload.chapters.length > latest.length ? "Showing the latest 80 chapters." : "",
    kind: "manga",
  };
}

async function kiryuuDetail(slug) {
  const payload = await fetchJson(`${SANKA}/comic/kiryuu/manga/${encodeURIComponent(slug)}`);
  if (!payload?.title) return null;
  try {
    const readable = await komikstationDetail(slug);
    if (readable?.chapters?.length) {
      const detail = {
        ...readable,
        id: `kiryuu:${slug}`,
        image: payload.imageSrc || readable.image,
        title: payload.title || readable.title,
        description: plainText(payload.synopsis) || readable.description,
        notice: ["Chapter pages come from Komikstation.", readable.notice].filter(Boolean).join(" "),
      };
      remember([detail]);
      return detail;
    }
  } catch {
    // Komikstation does not have this slug. Keep the Kiryuu record.
  }
  const chapters = (payload.chapters || []).map((chapter) => ({
    id: "",
    number: chapter.slug,
    title: String(chapter.title || "Chapter").replace(/\s+/g, " ").trim(),
    pages: 0,
  }));
  const detail = {
    id: `kiryuu:${slug}`,
    source: "kiryuu",
    title: payload.title,
    image: payload.imageSrc || "",
    rating: payload.rating ? Number(payload.rating) : null,
    description: plainText(payload.synopsis),
    episodes: [],
    chapters,
    notice: "Kiryuu has the cover and chapter names. Page images are not available from that source.",
    kind: "manga",
  };
  remember([detail]);
  return detail;
}

async function listAnimeFresh(preset, page = 1) {
  const anilistPreset = {
    recent: { sort: "POPULARITY_DESC", status: "RELEASING" },
    trending: { sort: "TRENDING_DESC" },
    popular: { sort: "POPULARITY_DESC" },
    all: { sort: "FAVOURITES_DESC" },
  }[preset] || { sort: "POPULARITY_DESC" };

  return firstList([
    () => anilistPage({ type: "ANIME", page, ...anilistPreset }),
    () => {
      if (preset === "trending" && page === 1) {
        return kitsuCollection("/trending/anime?limit=20", "anime");
      }
      return kitsuCollection(kitsuListPath("anime", preset, page), "anime");
    },
    () => (preset === "recent" ? sankaAnimeList(page) : Promise.resolve({ items: [] })),
  ]);
}

async function searchAnimeFresh(query, page = 1) {
  return firstList([
    () => anilistPage({ type: "ANIME", page, sort: "SEARCH_MATCH", search: query }),
    () => {
      const params = new URLSearchParams();
      params.set("filter[text]", query);
      params.set("page[limit]", "20");
      params.set("page[offset]", String((page - 1) * 20));
      return kitsuCollection(`/anime?${params.toString()}`, "anime");
    },
    () => sankaSearch(query),
  ]);
}

async function loadMangapillChapters(title) {
  const search = await fetchJson(`${CONSUMET}/manga/mangapill/${encodeURIComponent(title)}`, {
    timeout: 6000,
  });
  const hit = bestTitleMatch(title, search.results || [], (row) => row.title);
  if (!hit?.id) return [];
  const info = await fetchJson(
    `${CONSUMET}/manga/mangapill/info?id=${encodeURIComponent(hit.id)}`,
    { timeout: 8000 }
  );
  return (info.chapters || [])
    .map((chapter, index) => ({
      id: `mangapill:${chapter.id}`,
      number: chapter.chapter || index + 1,
      title: chapter.title || `Chapter ${chapter.chapter || index + 1}`,
      pages: 1,
    }))
    .sort((left, right) => {
      const leftNumber = parseFloat(left.number);
      const rightNumber = parseFloat(right.number);
      const leftOk = Number.isFinite(leftNumber);
      const rightOk = Number.isFinite(rightNumber);
      if (leftOk && rightOk && leftNumber !== rightNumber) return leftNumber - rightNumber;
      if (leftOk && !rightOk) return -1;
      if (!leftOk && rightOk) return 1;
      return 0;
    });
}

export function findMangaReader(title) {
  const key = `mp:reader:${String(title || "").toLowerCase().trim()}`;
  return cached(key, () => loadMangapillChapters(title));
}

async function getAnimeDetailFresh(catalogId) {
  const parsed = parseCatalogId(catalogId);
  const loaders = {
    anilist: (raw) => anilistDetail(raw, "ANIME"),
    kitsu: (raw) => kitsuAnimeDetail(raw),
    sanka: (raw) => sankaAnimeDetail(raw),
  };
  try {
    if (!loaders[parsed.source]) throw new Error("Unknown anime source");
    const detail = await loaders[parsed.source](parsed.raw);
    if (!detail?.title) throw new Error("Anime title was not found");
    return attachPreview(await attachPlayableEpisodes(detail));
  } catch (error) {
    const fallback = await fallbackDetail(parsed, recall(parsed.id), searchAnime, loaders);
    if (fallback) return attachPreview(await attachPlayableEpisodes(fallback));
    throw error;
  }
}

async function listMangaFresh(page = 1) {
  return firstList([
    () => kiryuuList(page),
    () => mangadexList(page),
    () => kitsuCollection(kitsuListPath("manga", "popular", page), "manga"),
    () => anilistPage({ type: "MANGA", page, sort: "POPULARITY_DESC" }),
  ]);
}

async function searchMangaFresh(query, page = 1) {
  return firstList([
    () => kiryuuSearch(query),
    () => mangadexList(page, query),
    () => {
      const params = new URLSearchParams();
      params.set("filter[text]", query);
      params.set("page[limit]", "20");
      params.set("page[offset]", String((page - 1) * 20));
      return kitsuCollection(`/manga?${params.toString()}`, "manga");
    },
    () => anilistPage({ type: "MANGA", page, sort: "SEARCH_MATCH", search: query }),
  ]);
}

async function getMangaDetailFresh(catalogId) {
  const parsed = parseCatalogId(catalogId);
  const loaders = {
    mangadex: (raw) => mangadexDetail(raw),
    kitsu: (raw) => kitsuMangaDetail(raw),
    anilist: (raw) => anilistDetail(raw, "MANGA"),
    kiryuu: (raw) => kiryuuDetail(raw),
    komikstation: (raw) => komikstationDetail(raw),
  };
  try {
    if (!loaders[parsed.source]) throw new Error("Unknown manga source");
    return await loaders[parsed.source](parsed.raw);
  } catch (error) {
    const fallback = await fallbackDetail(parsed, recall(parsed.id), searchManga, loaders);
    if (fallback) return fallback;
    throw error;
  }
}

const TMDB_KEY = "152f41397d36a9af171b938124f0281c";

export function listAnime(preset, page = 1) {
  return cached(`anime:${preset}:${page}`, () => listAnimeFresh(preset, page));
}

export function searchAnime(query, page = 1) {
  const q = String(query || "").trim();
  return cached(`anime-search:${q.toLowerCase()}:${page}`, () => searchAnimeFresh(q, page));
}

export function getAnimeDetail(catalogId) {
  return cached(`anime-detail:${catalogId}`, () => getAnimeDetailFresh(catalogId), DETAIL_TTL);
}

export function listManga(page = 1) {
  return cached(`manga:${page}`, () => listMangaFresh(page));
}

export function searchManga(query, page = 1) {
  const q = String(query || "").trim();
  return cached(`manga-search:${q.toLowerCase()}:${page}`, () => searchMangaFresh(q, page));
}

export function getMangaDetail(catalogId) {
  return cached(`manga-detail:${catalogId}`, () => getMangaDetailFresh(catalogId), DETAIL_TTL);
}

export function loadTmdbList({ kind, path, page = 1, search = "" }) {
  const query = String(search || "").trim();
  return cached(`tmdb:${kind}:${path}:${page}:${query.toLowerCase()}`, async () => {
    const url = query
      ? `https://api.themoviedb.org/3/search/${kind}?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&page=${page}`
      : `${path}${path.includes("?") ? "&" : "?"}page=${page}`;
    const data = await fetchJson(url, { timeout: 6000 });
    return {
      items: (data.results || []).map((row) => ({
        id: row.id,
        title: kind === "tv" ? (row.name || row.original_name) : row.title,
        image: row.poster_path ? `https://image.tmdb.org/t/p/w342${row.poster_path}` : "",
        rating: row.vote_average,
      })),
      totalPages: Math.min(data.total_pages || 1, 500),
      source: "TMDB",
    };
  });
}

export function loadHomeBillboard() {
  return cached("tmdb:home:now", async () => {
    const data = await fetchJson(
      `https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_KEY}`,
      { timeout: 6000 }
    );
    return (data.results || [])
      .filter((movie) => movie.poster_path && movie.backdrop_path)
      .slice(0, 16)
      .map((movie) => ({
        id: movie.id,
        title: movie.title,
        overview: movie.overview,
        poster_path: movie.poster_path,
        backdrop_path: movie.backdrop_path,
      }));
  });
}

export function loadPokemon(page = 1, search = "") {
  const query = String(search || "").trim().toLowerCase();
  return cached(`poke:${page}:${query}`, async () => {
    if (query) {
      try {
        const data = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(query)}`);
        return { items: [mapPokemon(data)], totalPages: 1, source: "PokeAPI" };
      } catch {
        return { items: [], totalPages: 1, source: "PokeAPI" };
      }
    }
    const data = await fetchJson(`https://pokeapi.co/api/v2/pokemon?limit=20&offset=${(page - 1) * 20}`);
    return {
      items: (data.results || []).map((row) => {
        const id = row.url.split("/").filter(Boolean).pop();
        return mapPokemon({ id, name: row.name });
      }),
      totalPages: Math.max(1, Math.ceil((data.count || 20) / 20)),
      source: "PokeAPI",
    };
  });
}

function mapPokemon(data) {
  const name = data.name || "Pokemon";
  return {
    id: data.id,
    title: name.charAt(0).toUpperCase() + name.slice(1),
    image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${data.id}.png`,
    source: "PokeAPI",
  };
}
