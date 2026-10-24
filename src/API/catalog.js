// Live sources probed from this environment:
// AniList, Kitsu, and MangaDex return titles plus cover URLs and allow browser CORS.
// Not wired: Jikan (connection timeout), MangaMint (bot-check HTML), CopyManga
// (empty list or "upgrade the app", no titles), Sankanime (Cloudflare challenge),
// Consumet (HTTP 500). Nekidev/anime-api is a Python wrapper library, not a host.

const ANILIST = "https://graphql.anilist.co";
const KITSU = "https://kitsu.io/api/edge";
const MANGADEX = "https://api.mangadex.org";
const KITSU_ACCEPT = "application/vnd.api+json";
const CACHE_KEY = "streamgod.catalog.v1";
const HTTP_KEY = "streamgod.http.v1";
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

function sameWork(left, right) {
  const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
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
      episodes
      chapters
      status
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

export function getMangaPages(chapterId) {
  if (!chapterId) return Promise.resolve([]);
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
  ]);
}

async function getAnimeDetailFresh(catalogId) {
  const parsed = parseCatalogId(catalogId);
  const loaders = {
    anilist: (raw) => anilistDetail(raw, "ANIME"),
    kitsu: (raw) => kitsuAnimeDetail(raw),
  };
  try {
    if (!loaders[parsed.source]) throw new Error("Unknown anime source");
    return await loaders[parsed.source](parsed.raw);
  } catch (error) {
    const fallback = await fallbackDetail(parsed, recall(parsed.id), searchAnime, {
      anilist: (raw) => anilistDetail(raw, "ANIME"),
      kitsu: kitsuAnimeDetail,
    });
    if (fallback) return fallback;
    throw error;
  }
}

async function listMangaFresh(page = 1) {
  return firstList([
    () => mangadexList(page),
    () => kitsuCollection(kitsuListPath("manga", "popular", page), "manga"),
    () => anilistPage({ type: "MANGA", page, sort: "POPULARITY_DESC" }),
  ]);
}

async function searchMangaFresh(query, page = 1) {
  return firstList([
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
