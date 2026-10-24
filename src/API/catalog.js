// Live sources probed from this environment:
// AniList, Kitsu, and MangaDex: titles, covers, and (MangaDex) chapter pages. Browser CORS.
// Consumet https://consumet-api-m8mf.onrender.com : Gogoanime search is an empty list.
// Zoro and AnimePahe return HTTP 500. MangaPill page CDNs answer 403, so those
// image buttons are not offered. Used only as a chapter lookup, never the grid.
// docs.consumet.org names https://api.consumet.org. That host answers 451 and
// its manga routes redirect to the GitHub install readme, so it is not called.
// Comick api.comick.dev lists English Kagurabachi through chapter 135 and has
// no chapter 136, but get_images is empty (no page URL). HiAnime, FlixHQ, and
// Mangakakalot did not answer. Asura and Gogoanime return HTML, not a new
// playable URL. None of those become a source pill or embed.
// Shikimori https://shikimori.io/api : CORS *, YouTube trailer/opening embeds.
// Sanka https://www.sankavollerei.web.id : CORS *. Episode servers become player buttons.
// Komikstation chapter images and Kiryuu covers come from the same host.
// Weeb Central https://weebcentral.com : English chapter lists and page images.
// Sanka comic routes that returned chapter lists and HTTP 200 page images:
// BacaKomik, Komikindo, Komikstation, and MangaKita. Those pages are Indonesian,
// so they are extra pills and never the default reader.
// Rejected after a live probe: Komiku, Maid, SoulScans, Meganei, Komikcast,
// Bacaman, Softkomik, Westmanga, Cosmic Scans, and Komikuindo answered 403 or 500.
// Kiryuu's chapter route answered 500. Shinigami lists chapters, then
// assets.shngm.id images answer 403. Mangasusuku is adult and is not called.
// Nozu https://nozu.me/api/v1 : CORS *. Covers, banners, and official stream links.
// Not wired: AnimePahe (the public search answers with an anti-bot HTML page, and the
// published API says it is waiting on a Cloudflare UAM fix — no bypass is included).
// Fetch-Stream https://fetch-stream.vercel.app returns Vercel DEPLOYMENT_NOT_FOUND.
// Jikan, MangaMint, CopyManga, sankanime.web.id, HiAnime, AllAnime, and Crunchyroll
// did not return a usable public response.

const ANILIST = "https://graphql.anilist.co";
const SANKA = "https://www.sankavollerei.web.id";
const NOZU = "https://nozu.me/api/v1";
const KITSU = "https://kitsu.io/api/edge";
const MANGADEX = "https://api.mangadex.org";
const CONSUMET = "https://consumet-api-m8mf.onrender.com";
const SHIKIMORI = "https://shikimori.io/api";
const KITSU_ACCEPT = "application/vnd.api+json";
const CACHE_KEY = "streamgod.catalog.v2";
const HTTP_KEY = "streamgod.http.v16";
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
      weebcentral: "Weeb Central",
      sanka: "Sanka",
      nozu: "Nozu",
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

export function searchMatchScore(query, title) {
  const rank = titleRank(query, title);
  if (rank) return rank;
  const wanted = compactTitle(query);
  const found = compactTitle(title);
  if (!wanted || !found || Math.min(wanted.length, found.length) < 4) return 0;
  if (found.includes(wanted) || wanted.includes(found)) return 80;
  return 0;
}

export function rankMangaSearch(query, lists) {
  const ranked = [];
  (lists || []).forEach((list) => {
    (list?.items || []).forEach((item) => {
      const score = searchMatchScore(query, item?.title);
      if (score < 80) return;
      ranked.push({
        item,
        score,
        priority: Number.isFinite(list.priority) ? list.priority : 50,
      });
    });
  });
  ranked.sort((left, right) => (
    right.score - left.score
    || left.priority - right.priority
    || String(left.item.title).localeCompare(String(right.item.title))
  ));
  const seen = new Set();
  const items = [];
  ranked.forEach((row) => {
    const key = compactTitle(row.item.title);
    if (!key || seen.has(key)) return;
    seen.add(key);
    items.push(row.item);
  });
  return items;
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

function readHttp(key, allowExpired = false) {
  try {
    const all = JSON.parse(sessionStorage.getItem(HTTP_KEY) || "{}");
    const row = all[key];
    if (!row) return null;
    if (!allowExpired && row.exp < Date.now()) return null;
    return row.value;
  } catch {
    return null;
  }
}

function writeHttp(key, value, ttl) {
  const save = (all) => {
    all[key] = { exp: Date.now() + ttl, value };
    const keys = Object.keys(all);
    if (keys.length > 40) {
      keys.slice(0, keys.length - 40).forEach((stale) => delete all[stale]);
    }
    sessionStorage.setItem(HTTP_KEY, JSON.stringify(all));
  };
  try {
    save(JSON.parse(sessionStorage.getItem(HTTP_KEY) || "{}"));
  } catch {
    try {
      save({});
    } catch {
      // Quota and private mode keep the in-memory copy.
    }
  }
}

function hasPayload(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.length > 0;
  if (value && Array.isArray(value.items)) return value.items.length > 0;
  if (value && typeof value === "object") return Boolean(value.title || value.id);
  return false;
}

function markStale(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...value, stale: true };
  }
  return value;
}

function cached(key, loader, ttl = LIST_TTL, fresh = false) {
  const now = Date.now();
  if (!fresh) {
    const mem = responseMemory.get(key);
    if (mem && mem.exp > now) return Promise.resolve(mem.value);

    const stored = readHttp(key);
    if (stored != null) {
      responseMemory.set(key, { exp: now + ttl, value: stored });
      return Promise.resolve(stored);
    }

    if (inflight.has(key)) return inflight.get(key);
  }

  const promise = Promise.resolve()
    .then(loader)
    .then((value) => {
      const empty = Array.isArray(value) ? value.length === 0 : value?.items?.length === 0;
      if (empty && value?.noStore) throw value;
      const keep = empty ? Math.min(ttl, 90 * 1000) : ttl;
      const clean = value && typeof value === "object" && !Array.isArray(value)
        ? { ...value, stale: false }
        : value;
      responseMemory.set(key, { exp: Date.now() + keep, value: clean });
      writeHttp(key, value, keep);
      inflight.delete(key);
      return clean;
    })
    .catch((error) => {
      inflight.delete(key);
      const mem = responseMemory.get(key);
      const expired = readHttp(key, true);
      const fallback = (mem && hasPayload(mem.value) ? mem.value : null)
        || (hasPayload(expired) ? expired : null);
      if (fallback) {
        const stale = markStale(fallback);
        responseMemory.set(key, { exp: Date.now() + 20 * 1000, value: stale });
        return stale;
      }
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

async function fetchText(url, options = {}) {
  const timeout = options.timeout || REQUEST_TIMEOUT;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Accept: "text/html",
        ...(options.headers || {}),
      },
    });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

// If a catalog is still pending after this, start the next one. The earliest list that
// has items still wins, and a source that answers immediately never starts the next.
const LIST_HEDGE_MS = 650;

async function firstList(calls) {
  const slots = calls.map((call) => ({ call, started: false, promise: null }));
  const start = (index) => {
    const slot = slots[index];
    if (!slot || slot.started) return slot?.promise;
    slot.started = true;
    slot.promise = Promise.resolve().then(() => slot.call());
    slot.promise.catch(() => {});
    return slot.promise;
  };

  let sawSuccess = false;
  let lastError = null;

  for (let index = 0; index < slots.length; index += 1) {
    const promise = start(index);
    let timer;
    const hedge = index + 1 < slots.length
      ? new Promise((resolve) => {
          timer = setTimeout(() => {
            start(index + 1);
            resolve("hedge");
          }, LIST_HEDGE_MS);
        })
      : null;
    try {
      const outcome = await Promise.race([
        promise.then((value) => ({ kind: "value", value })).catch((error) => ({ kind: "error", error })),
        ...(hedge ? [hedge] : []),
      ]);
      if (outcome === "hedge") {
        try {
          const value = await promise;
          sawSuccess = true;
          if (value?.items?.length) {
            remember(value.items);
            return value;
          }
        } catch (error) {
          lastError = error;
        }
        continue;
      }
      if (outcome.kind === "error") {
        lastError = outcome.error;
        continue;
      }
      sawSuccess = true;
      if (outcome.value?.items?.length) {
        remember(outcome.value.items);
        return outcome.value;
      }
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  if (!sawSuccess && lastError) throw lastError;
  return { items: [], hasNext: false, source: "" };
}

function titleBundle(display, extras) {
  const title = String(display || "").trim() || "Untitled";
  const seen = new Set([compactTitle(title)]);
  const altTitles = [];
  (extras || []).forEach((name) => {
    const value = String(name || "").trim();
    const key = compactTitle(value);
    if (!value || !key || seen.has(key)) return;
    seen.add(key);
    altTitles.push(value);
  });
  return { title, altTitles };
}

function anilistTitle(media) {
  return media?.title?.english || media?.title?.romaji || media?.title?.native || "Untitled";
}

function anilistItem(media, sourceType) {
  const nextEpisode = media?.nextAiringEpisode?.episode;
  const names = titleBundle(anilistTitle(media), [
    media?.title?.romaji,
    media?.title?.english,
    media?.title?.native,
  ]);
  return {
    id: `anilist:${media.id}`,
    source: "anilist",
    title: names.title,
    altTitles: names.altTitles,
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
        title { romaji english native }
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
  const titles = attributes.titles || {};
  const names = titleBundle(
    attributes.canonicalTitle || titles.en || titles.en_jp || attributes.slug,
    [titles.en, titles.en_jp, titles.ja_jp, attributes.canonicalTitle]
  );
  return {
    id: `kitsu:${resource.id}`,
    source: "kitsu",
    title: names.title,
    altTitles: names.altTitles,
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

function collectWatchLinks(externalLinks, streamed) {
  const official = (externalLinks || [])
    .filter((link) => String(link.type || "").toUpperCase() === "STREAMING" && link.url)
    .map((link) => ({
      label: link.site || "Watch",
      url: String(link.url).replace(/^http:\/\//i, "https://"),
    }));
  const episodeLinks = (streamed || [])
    .filter((episode) => episode.url)
    .map((episode) => ({ label: episode.site || episode.title, url: episode.url }));
  const watchLinks = [];
  const seen = new Set();
  [...official, ...episodeLinks].forEach((link) => {
    const key = String(link.url || "");
    if (!key || seen.has(key)) return;
    seen.add(key);
    watchLinks.push(link);
  });
  return watchLinks.slice(0, 8);
}

async function anilistDetail(rawId, type) {
  const query = `query ($id: Int, $type: MediaType) {
    Media(id: $id, type: $type) {
      id
      title { romaji english native }
      description(asHtml: false)
      coverImage { extraLarge large }
      averageScore
      idMal
      episodes
      chapters
      status
      trailer { id site }
      streamingEpisodes { title thumbnail url site }
      externalLinks { site url type }
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
    watchLinks: collectWatchLinks(media.externalLinks, streamed),
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

function mangaDexUrl(pathAndQuery) {
  // Jest talks to the public API directly. The browser uses the same-origin proxy
  // because api.mangadex.org does not allow this page's origin.
  if (process.env.NODE_ENV !== "test" && typeof window !== "undefined") {
    return `/api/mangadex${pathAndQuery}`;
  }
  return `${MANGADEX}${pathAndQuery}`;
}

function mangaDexPageUrl(absolute) {
  if (process.env.NODE_ENV === "test" || typeof window === "undefined") return absolute;
  return `/api/mangadex-image?url=${encodeURIComponent(absolute)}`;
}

function mdUrl(path, pairs) {
  const params = new URLSearchParams();
  pairs.forEach(([key, value]) => params.append(key, value));
  const query = params.toString();
  return mangaDexUrl(`${path}${query ? `?${query}` : ""}`);
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

const FEED_LIMIT = 100;
const FEED_MAX_PAGES = 40;

function chapterNumber(value) {
  const number = parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function hostedFeedRows(rows) {
  return (rows || []).filter((chapter) => {
    const attributes = chapter.attributes || {};
    return !attributes.externalUrl && Number(attributes.pages) > 0;
  });
}

function pickHostedLanguage(rows) {
  const groups = new Map();
  hostedFeedRows(rows).forEach((chapter) => {
    const language = chapter.attributes?.translatedLanguage || "";
    if (!groups.has(language)) groups.set(language, []);
    groups.get(language).push(chapter);
  });
  let best = [];
  let bestHighest = -1;
  let bestCount = -1;
  let bestIsEnglish = false;
  groups.forEach((list, language) => {
    const highest = list.reduce((max, chapter) => {
      const number = chapterNumber(chapter.attributes?.chapter);
      return number == null ? max : Math.max(max, number);
    }, -1);
    const english = language === "en";
    const better = highest > bestHighest
      || (highest === bestHighest && english && !bestIsEnglish)
      || (highest === bestHighest && english === bestIsEnglish && list.length > bestCount);
    if (better) {
      best = list;
      bestHighest = highest;
      bestCount = list.length;
      bestIsEnglish = english;
    }
  });
  return best;
}

function chapterEntries(rows) {
  const byNumber = new Map();
  rows.forEach((chapter) => {
    const attributes = chapter.attributes || {};
    const number = attributes.chapter || "";
    const entry = {
      id: chapter.id,
      number: number || byNumber.size + 1,
      title: attributes.title
        ? `Chapter ${number || "?"} — ${attributes.title}`
        : `Chapter ${number || "?"}`,
      pages: Number(attributes.pages) || 0,
      language: attributes.translatedLanguage || "",
    };
    const key = String(number || chapter.id);
    const previous = byNumber.get(key);
    if (!previous || entry.pages > previous.pages) byNumber.set(key, entry);
  });
  return [...byNumber.values()].sort((left, right) => {
    const leftNumber = chapterNumber(left.number);
    const rightNumber = chapterNumber(right.number);
    if (leftNumber != null && rightNumber != null && leftNumber !== rightNumber) return leftNumber - rightNumber;
    if (leftNumber != null && rightNumber == null) return -1;
    if (leftNumber == null && rightNumber != null) return 1;
    return 0;
  });
}

async function loadMangaDexFeed(mangaId, language) {
  const chapters = [];
  let offset = 0;
  for (let page = 0; page < FEED_MAX_PAGES; page += 1) {
    const pairs = [
      ["limit", String(FEED_LIMIT)],
      ["offset", String(offset)],
      ["order[volume]", "asc"],
      ["order[chapter]", "asc"],
      ["includeFuturePublishAt", "0"],
      ["contentRating[]", "safe"],
      ["contentRating[]", "suggestive"],
      ["includeExternalUrl", "0"],
    ];
    if (language) pairs.push(["translatedLanguage[]", language]);
    const payload = await fetchJson(mdUrl(`/manga/${mangaId}/feed`, pairs), { timeout: 8000 });
    const batch = payload.data || [];
    chapters.push(...batch);
    const total = Number(payload.total);
    offset += batch.length || FEED_LIMIT;
    if (!batch.length) break;
    if (Number.isFinite(total) && offset >= total) break;
    if (!Number.isFinite(total) && batch.length < FEED_LIMIT) break;
  }
  return chapters;
}

function highestChapterNumber(chapters) {
  return (chapters || []).reduce((best, chapter) => {
    const number = chapterNumber(chapter.number);
    return number != null && number > best ? number : best;
  }, 0);
}

function hostedChapterNotice(title, chapters, sourceName = "MangaDex") {
  if (!/kagurabachi/i.test(String(title || ""))) return "";
  const nearest = highestChapterNumber(chapters);
  if (nearest >= 136) return "";
  return nearest
    ? `Chapter 136 is not on ${sourceName}. Showing chapter ${nearest}.`
    : `Chapter 136 is not on ${sourceName}.`;
}

async function mangadexChapters(mangaId) {
  return cached(`md:chapters:${mangaId}`, async () => {
    const rows = await loadMangaDexFeed(mangaId, "");
    return chapterEntries(pickHostedLanguage(rows));
  }, 10 * 60 * 1000);
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
    notice = hostedChapterNotice(item.title, chapters);
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

function collectServers(server) {
  const preferred = ["filedon", "vidhide", "mega", "blogs", "odcdn", "odstream"];
  const byName = new Map();
  (server?.qualities || []).forEach((quality) => {
    const qualityLabel = String(quality.title || quality.quality || "").trim();
    (quality.serverList || []).forEach((entry) => {
      const name = String(entry.title || "").trim();
      if (!name || !entry.serverId) return;
      byName.set(name.toLowerCase(), {
        id: entry.serverId,
        name,
        quality: qualityLabel,
        label: qualityLabel ? `${name} ${qualityLabel}` : name,
      });
    });
  });
  return [...byName.values()].sort((left, right) => {
    const rank = (entry) => {
      const index = preferred.findIndex((token) => entry.name.toLowerCase().includes(token));
      return index === -1 ? preferred.length : index;
    };
    return rank(left) - rank(right);
  });
}

export function loadEpisodeServers(episodeId) {
  if (!episodeId) return Promise.resolve([]);
  return cached(`sanka:servers:${episodeId}`, async () => {
    const episode = await fetchJson(`${SANKA}/anime/episode/${encodeURIComponent(episodeId)}`);
    const servers = collectServers(episode?.data?.server);
    if (servers.length) return servers;
    const fallback = episode?.data?.defaultStreamingUrl || "";
    return fallback ? [{ id: "", name: "Default", quality: "", label: "Default", url: fallback }] : [];
  }, 10 * 60 * 1000);
}

export function isPlayableEmbed(url) {
  const value = String(url || "").trim();
  if (!/^https:\/\//i.test(value)) return false;
  let host = "";
  try {
    host = new URL(value).hostname;
  } catch {
    return false;
  }
  const hostAndUrl = `${host} ${value}`;
  if (/desustream|crunchyroll|funimation|netflix|hulu|bilibili|hidive|disney|primevideo|iqiyi|wetv|hoopla|aniplus/i.test(hostAndUrl)) return false;
  if (/\/maintenance\/?/i.test(value)) return false;
  return true;
}

export function resolveEpisodeServer(server) {
  if (!server) return Promise.resolve("");
  if (server.url) return Promise.resolve(isPlayableEmbed(server.url) ? server.url : "");
  if (!server.id) return Promise.resolve("");
  return cached(`sanka:server:${server.id}`, async () => {
    const resolved = await fetchJson(`${SANKA}/anime/server/${encodeURIComponent(server.id)}`);
    return resolved?.data?.url || "";
  }, 10 * 60 * 1000).then((url) => (isPlayableEmbed(url) ? url : ""));
}

export function loadEpisodeEmbed(episodeId) {
  return loadEpisodeServers(episodeId).then(async (servers) => {
    for (const server of servers) {
      const url = await resolveEpisodeServer(server);
      if (url) return url;
    }
    return "";
  });
}

const WEEB = "https://weebcentral.com";
const WEEB_ID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const WEEB_PAGE_HOSTS = new Set(["scans-hot.planeptune.us", "scans.lastation.us", "official.lowee.us"]);

function pageHostname() {
  if (typeof window === "undefined" || !window.location) return "";
  return String(window.location.hostname || "");
}

// The browser always calls the same-origin proxy, including a deployed host
// such as onrender.com. Jest keeps the public host on localhost so existing
// mocks stay stable, and uses the proxy when the page hostname is not local.
export function weebRequestUrl(pathAndQuery, hostname = pageHostname()) {
  const host = String(hostname || "").toLowerCase();
  const local = !host || host === "localhost" || host === "127.0.0.1";
  if (process.env.NODE_ENV === "test" && local) return `${WEEB}${pathAndQuery}`;
  if (typeof window !== "undefined" || !local) return `/api/weebcentral${pathAndQuery}`;
  return `${WEEB}${pathAndQuery}`;
}

function weebUrl(pathAndQuery) {
  return weebRequestUrl(pathAndQuery);
}

export function weebPageRequestUrl(absolute, hostname = pageHostname()) {
  const host = String(hostname || "").toLowerCase();
  const local = !host || host === "localhost" || host === "127.0.0.1";
  if (process.env.NODE_ENV === "test" && local) return absolute;
  if (typeof window !== "undefined" || !local) return `/api/weeb-image?url=${encodeURIComponent(absolute)}`;
  return absolute;
}

function weebPageUrl(absolute) {
  return weebPageRequestUrl(absolute);
}

function decodeHtml(value) {
  return plainText(String(value || "").replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code))));
}

export function comicPageUrls(urls) {
  return readerPageUrls(urls).filter((url) => {
    if (/\.gif(?:$|\?)/i.test(url)) return false;
    if (/googleusercontent|blogspot/i.test(url)) return false;
    if (/masterimage-series/i.test(url)) return false;
    if (/\/wp-content\/uploads\//i.test(url)) return false;
    return true;
  });
}

export function readerPageUrls(urls) {
  return (urls || [])
    .map((item) => (typeof item === "string" ? item : item?.url || item?.img || ""))
    .map((url) => String(url || "").trim())
    .filter((url) => {
      if (!url) return false;
      if (/mangapill|readdetectiveconan/i.test(url)) return false;
      if (/jackpot|bisa[\s-]*pecah|modal[\s-]*rece|iklan|doubleclick|googlesyndication|adsterra|popads|exoclick|hilltopads|clickadu|juicyads|\/ads?\//i.test(url)) return false;
      return /^https:\/\//i.test(url) || url.startsWith("/api/mangadex-image") || url.startsWith("/api/weeb-image");
    });
}

export function parseWeebSearch(html) {
  const rows = [];
  const seen = new Set();
  const pattern = /data-tip="([^"]+)"[\s\S]{0,400}?href="(?:https:\/\/weebcentral\.com)?\/series\/([0-9A-HJKMNP-TV-Z]{26})\//gi;
  let match = pattern.exec(String(html || ""));
  while (match) {
    const title = decodeHtml(match[1]);
    const id = match[2];
    if (title && WEEB_ID.test(id) && !seen.has(id)) {
      seen.add(id);
      rows.push({
        id,
        title,
        image: `https://temp.compsci88.com/cover/normal/${id}.webp`,
      });
    }
    match = pattern.exec(String(html || ""));
  }
  return rows;
}

export function parseWeebTitle(html) {
  const page = String(html || "");
  const heading = page.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/i);
  if (heading) return decodeHtml(heading[1]);
  const title = page.match(/<title>\s*([^<|]+)/i);
  return title ? decodeHtml(title[1]) : "";
}

export function parseWeebChapters(html) {
  const chapters = [];
  const seen = new Set();
  const pattern = /href="(?:https:\/\/weebcentral\.com)?\/chapters\/([0-9A-HJKMNP-TV-Z]{26})"[\s\S]{0,800}?<span class="">([^<]+)<\/span>/gi;
  let match = pattern.exec(String(html || ""));
  while (match) {
    const id = match[1];
    if (WEEB_ID.test(id) && !seen.has(id)) {
      seen.add(id);
      const label = decodeHtml(match[2]).replace(/\s+/g, " ").trim();
      const numberMatch = label.match(/(\d+(?:\.\d+)?)/);
      const number = numberMatch ? numberMatch[1] : label;
      chapters.push({
        id: `weebchapter:${id}`,
        number,
        title: label || `Chapter ${number}`,
        pages: 1,
      });
    }
    match = pattern.exec(String(html || ""));
  }
  return chapters;
}

export function parseWeebPageUrls(html) {
  const urls = [];
  const pattern = /<img\b[^>]*\bsrc="(https:\/\/[^"]+)"[^>]*>/gi;
  let match = pattern.exec(String(html || ""));
  while (match) {
    const src = match[1];
    try {
      const parsed = new URL(src);
      const pageHost = WEEB_PAGE_HOSTS.has(parsed.hostname) && parsed.pathname.startsWith("/manga/");
      const pageAlt = /alt="Page\s+\d+"/i.test(match[0]);
      if (pageHost && pageAlt) urls.push(src);
    } catch {
      // Skip a tag whose src is not a URL.
    }
    match = pattern.exec(String(html || ""));
  }
  return readerPageUrls(urls);
}

export function getMangaPages(chapterId) {
  if (!chapterId) return Promise.resolve([]);
  if (String(chapterId).startsWith("weebchapter:")) {
    const id = String(chapterId).slice("weebchapter:".length);
    if (!WEEB_ID.test(id)) return Promise.resolve([]);
    return cached(`weeb:pages:${id}`, async () => {
      const html = await fetchText(
        weebUrl(`/chapters/${id}/images?is_prev=False&reading_style=long_strip`),
        { timeout: 8000 }
      );
      return parseWeebPageUrls(html).map(weebPageUrl);
    }, 8 * 60 * 1000);
  }
  if (String(chapterId).startsWith("sanka:")) {
    const rest = String(chapterId).slice("sanka:".length);
    const splitAt = rest.indexOf(":");
    const source = splitAt > 0 ? rest.slice(0, splitAt) : "";
    const slug = splitAt > 0 ? rest.slice(splitAt + 1) : "";
    if (!source || !slug || source === "mangasusuku") return Promise.resolve([]);
    return cached(`sanka:pages:${source}:${slug}`, async () => {
      const payload = await fetchJson(
        `${SANKA}/comic/${encodeURIComponent(source)}/chapter/${encodeURIComponent(slug)}`,
        { timeout: 8000 }
      );
      const images = payload?.data?.images || payload?.images || [];
      return comicPageUrls(images.map((item) => (typeof item === "string" ? item : item?.url)));
    }, 8 * 60 * 1000);
  }
  if (String(chapterId).startsWith("komikstation:")) {
    const slug = String(chapterId).slice("komikstation:".length);
    return cached(`ks:pages:${slug}`, async () => {
      const payload = await fetchJson(`${SANKA}/comic/komikstation/chapter/${encodeURIComponent(slug)}`, {
        timeout: 8000,
      });
      return comicPageUrls(Array.isArray(payload?.images) ? payload.images : []);
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
      return readerPageUrls(rows.map((row) => row.img));
    }, 8 * 60 * 1000);
  }
  return cached(`md:pages:${chapterId}`, async () => {
    const payload = await fetchJson(mangaDexUrl(`/at-home/server/${chapterId}`), { timeout: 8000 });
    const chapter = payload.chapter || {};
    const saver = chapter.dataSaver || [];
    const files = saver.length ? saver : chapter.data || [];
    const mode = saver.length ? "data-saver" : "data";
    if (!payload.baseUrl || !chapter.hash || !files.length) return [];
    return readerPageUrls(files.map((file) => mangaDexPageUrl(`${payload.baseUrl}/${mode}/${chapter.hash}/${file}`)));
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
        const loadNote = `Loaded from ${sourceLabel(detail.source)} because ${sourceLabel(parsed.source)} did not respond.`;
        const kept = String(detail.notice || "").trim();
        const keepChapter = /is not on /i.test(kept);
        return {
          ...detail,
          notice: keepChapter ? kept : loadNote,
          loadNotice: keepChapter ? loadNote : "",
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
    .filter((episode) => episode.episodeId && episode.number > 0)
    .sort((left, right) => right.number - left.number);
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

async function lookupMalId(title) {
  const found = await fetchJson(
    `${SHIKIMORI}/animes?search=${encodeURIComponent(title)}&limit=8`,
    { timeout: 3500 }
  );
  const rows = Array.isArray(found) ? found : [];
  let best = null;
  let bestScore = 0;
  rows.forEach((item) => {
    const score = titleRank(title, item.name);
    const shorter = best && String(item.name || "").length < String(best.name || "").length;
    if (score > bestScore || (score === bestScore && score >= 80 && shorter)) {
      best = item;
      bestScore = score;
    }
  });
  return bestScore >= 80 ? best.id : null;
}

async function attachPreview(detail) {
  if (!detail) return detail;
  try {
    let malId = detail.malId;
    if (!malId && detail.title) malId = await lookupMalId(detail.title);
    if (!malId) return detail;
    if (detail.preview?.embed) return malId === detail.malId ? detail : { ...detail, malId };
    let preview = detail.preview || null;
    try {
      const videos = await fetchJson(`${SHIKIMORI}/animes/${malId}/videos`, { timeout: 3500 });
      const rank = { pv: 0, op: 1, ed: 2, other: 3 };
      const picked = (Array.isArray(videos) ? videos : [])
        .filter((video) => video.hosting === "youtube" && youtubeId(video.player_url || video.url))
        .sort((left, right) => (rank[left.kind] ?? 9) - (rank[right.kind] ?? 9))[0];
      if (picked) {
        const kindLabel = { pv: "Trailer", op: "Opening", ed: "Ending", other: "Preview" }[picked.kind] || "Preview";
        preview = {
          label: "Trailer",
          embed: youtubeEmbed(youtubeId(picked.player_url || picked.url)),
          name: picked.name ? `${kindLabel}: ${picked.name}` : kindLabel,
        };
      }
    } catch {
      // A missing trailer still leaves the MAL id for the free embeds.
    }
    return { ...detail, malId, preview };
  } catch {
    return detail;
  }
}

function uniqueTitles(detail) {
  if (!String(detail?.title || "").trim()) return [];
  const bundled = titleBundle(detail.title, detail.altTitles);
  return [bundled.title, ...bundled.altTitles];
}

function withSankaEpisodes(detail, playable) {
  return {
    ...detail,
    episodes: playable.episodes,
    malId: detail.malId || null,
    notice: "Playback comes from Sanka. Poster and description stay with the catalog source.",
  };
}

async function attachPlayableEpisodes(detail) {
  if (!detail?.title || detail.source === "sanka") return detail;
  if ((detail.episodes || []).some((episode) => episode.episodeId)) return detail;
  const queries = uniqueTitles(detail);
  let loose = null;
  for (const query of queries) {
    try {
      const found = await sankaSearch(query);
      const exact = found.items.find((item) => queries.some((name) => playableTitle(name, item.title)));
      const words = String(query || "").trim().split(/\s+/).filter(Boolean);
      if (!exact) {
        if (!loose && words.length >= 2 && found.items[0]) {
          const candidate = await sankaAnimeDetail(parseCatalogId(found.items[0].id).raw);
          if (candidate?.episodes?.length) loose = candidate;
        }
        continue;
      }
      const playable = await sankaAnimeDetail(parseCatalogId(exact.id).raw);
      if (playable?.episodes?.length) return withSankaEpisodes(detail, playable);
    } catch {
      // The next spelling can still match Sanka.
    }
  }
  if (loose?.episodes?.length) return withSankaEpisodes(detail, loose);
  return detail;
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
        source: "kiryuu",
        image: readable.image || payload.imageSrc || "",
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

  const nozuPath = preset === "trending"
    ? "/trending?type=anime"
    : preset === "popular" || preset === "all"
      ? "/popular?type=anime"
      : "/latest?type=anime";

  const calls = [];
  if (preset === "trending") calls.push(() => nozuCollection(nozuPath, "anime"));
  calls.push(() => anilistPage({ type: "ANIME", page, ...anilistPreset }));
  if (preset !== "trending") calls.push(() => nozuCollection(nozuPath, "anime"));
  calls.push(() => {
    if (preset === "trending" && page === 1) {
      return kitsuCollection("/trending/anime?limit=20", "anime");
    }
    return kitsuCollection(kitsuListPath("anime", preset, page), "anime");
  });
  if (preset === "recent") calls.push(() => sankaAnimeList(page));
  return firstList(calls);
}

async function searchAnimeFresh(query, page = 1) {
  return firstList([
    () => anilistPage({ type: "ANIME", page, sort: "SEARCH_MATCH", search: query }),
    () => nozuCollection(`/search?type=anime&q=${encodeURIComponent(query)}`, "anime"),
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

const SANKA_COMIC_SOURCES = ["komikindo", "bacakomik"];

function readSankaChapterNumber(chapter) {
  const title = String(chapter?.title || chapter?.chapter_title || "");
  const titleMatch = title.match(/chapter\s*(\d+(?:\.\d+)?)/i) || title.match(/^(\d+(?:\.\d+)?)$/);
  if (titleMatch) return titleMatch[1];
  const slug = String(chapter?.slug || "");
  const slugMatch = slug.match(/chapter-(\d+(?:[.-]\d+)?)/i);
  return slugMatch ? slugMatch[1].replace("-", ".") : "";
}

export function parseSankaChapterPage(source, payload) {
  if (source === "shinigami") {
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    return rows.filter((row) => row?.chapter_id).map((row) => ({
      id: `sanka:shinigami:${row.chapter_id}`,
      number: String(row.chapter_number ?? ""),
      title: row.chapter_title
        ? `Chapter ${row.chapter_number} — ${row.chapter_title}`
        : `Chapter ${row.chapter_number}`,
      pages: 1,
    })).filter((chapter) => chapter.number);
  }
  const rows = source === "bacakomik"
    ? (payload?.detail?.chapters || [])
    : (payload?.data?.chapters || payload?.chapters || []);
  return rows.filter((row) => row?.slug).map((row) => {
    const number = readSankaChapterNumber(row);
    const label = String(row.title || "").replace(/\s+/g, " ").trim();
    return {
      id: `sanka:${source}:${row.slug}`,
      number: number || label,
      title: label || (number ? `Chapter ${number}` : "Chapter"),
      pages: 1,
    };
  }).filter((chapter) => chapter.id && !chapter.id.includes("mangapill:"));
}

export function sankaChapterPageInfo(payload) {
  const page = payload?.pagination || payload?.data?.pagination || {};
  const current = Number(page.currentPage || page.current_page || 1);
  const total = Number(page.total_pages || page.totalPages || 0);
  const hasNext = Boolean(page.hasNextPage) || (Number.isFinite(total) && total > current);
  return { current: Number.isFinite(current) ? current : 1, hasNext };
}

export function mergeSankaChapterPages(source, payloads) {
  const byId = new Map();
  (payloads || []).forEach((payload) => {
    parseSankaChapterPage(source, payload).forEach((chapter) => {
      if (!byId.has(chapter.id)) byId.set(chapter.id, chapter);
    });
  });
  return [...byId.values()];
}

function cleanComicTitle(value) {
  return String(value || "")
    .replace(/^komik\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readSankaComicMeta(source, payload) {
  const data = source === "bacakomik" ? (payload?.detail || {}) : (payload?.data || payload || {});
  const rating = Number(String(data.rating || "").replace(/[^0-9.]/g, ""));
  return {
    title: cleanComicTitle(data.title || payload?.title),
    image: data.image || data.cover || data.imageSrc || "",
    rating: Number.isFinite(rating) && rating > 0 ? rating : null,
    description: plainText(data.description || data.synopsis),
  };
}

async function loadSankaComic(source, slug) {
  let meta = { title: "", image: "", rating: null, description: "" };
  const payloads = [];
  for (let page = 1; page <= 40; page += 1) {
    const path = page === 1
      ? `/comic/${encodeURIComponent(source)}/detail/${encodeURIComponent(slug)}`
      : `/comic/${encodeURIComponent(source)}/detail/${encodeURIComponent(slug)}?page=${page}`;
    const payload = await fetchJson(`${SANKA}${path}`, { timeout: 8000 });
    if (!meta.title) meta = readSankaComicMeta(source, payload);
    payloads.push(payload);
    if (!sankaChapterPageInfo(payload).hasNext) break;
  }
  return { ...meta, chapters: mergeSankaChapterPages(source, payloads) };
}

async function sankaComicDetail(raw) {
  const splitAt = String(raw || "").indexOf(":");
  const source = splitAt > 0 ? raw.slice(0, splitAt) : "";
  const slug = splitAt > 0 ? raw.slice(splitAt + 1) : "";
  if (!SANKA_COMIC_SOURCES.includes(source) || !slug) {
    throw new Error("Unknown Sanka comic");
  }
  const comic = await loadSankaComic(source, slug);
  if (!comic.chapters.length) throw new Error("Sanka comic has no chapters");
  const detail = {
    id: `sanka:${source}:${slug}`,
    source: "sanka",
    title: comic.title || slug,
    image: comic.image,
    rating: comic.rating,
    description: comic.description,
    episodes: [],
    chapters: comic.chapters,
    notice: hostedChapterNotice(comic.title, comic.chapters, "Sanka") || "Chapter pages come from Sanka.",
    kind: "manga",
  };
  remember([detail]);
  return detail;
}

function weebSearchPath(query) {
  const params = new URLSearchParams();
  params.set("author", "");
  params.set("text", query);
  params.set("sort", "Best Match");
  params.set("order", "Descending");
  params.set("official", "Any");
  params.set("anime", "Any");
  params.set("adult", "False");
  params.set("display_mode", "Full Display");
  return `/search/data?${params.toString()}`;
}

async function weebCatalog(query) {
  const html = await fetchText(weebUrl(weebSearchPath(query)), { timeout: 8000 });
  return parseWeebSearch(html).map((row) => ({
    id: `weebcentral:${row.id}`,
    source: "weebcentral",
    title: row.title,
    image: row.image,
    rating: null,
    kind: "manga",
  }));
}

async function weebDetail(seriesId) {
  if (!WEEB_ID.test(seriesId)) throw new Error("Unknown Weeb Central comic");
  const [page, list] = await Promise.all([
    fetchText(weebUrl(`/series/${seriesId}`), { timeout: 8000 }),
    fetchText(weebUrl(`/series/${seriesId}/full-chapter-list`), { timeout: 12000 }),
  ]);
  const title = parseWeebTitle(page);
  const chapters = parseWeebChapters(list);
  if (!chapters.length) throw new Error("Weeb Central has no chapters");
  const detail = {
    id: `weebcentral:${seriesId}`,
    source: "weebcentral",
    title: title || seriesId,
    image: `https://temp.compsci88.com/cover/normal/${seriesId}.webp`,
    rating: null,
    description: "",
    episodes: [],
    chapters,
    notice: hostedChapterNotice(title, chapters, "Weeb Central") || "English chapter pages come from Weeb Central.",
    kind: "manga",
  };
  remember([detail]);
  return detail;
}

async function weebReader(title) {
  const html = await fetchText(weebUrl(weebSearchPath(title)), { timeout: 8000 });
  const hit = bestTitleMatch(title, parseWeebSearch(html), (row) => row.title);
  if (!hit) return null;
  const list = await fetchText(weebUrl(`/series/${hit.id}/full-chapter-list`), { timeout: 12000 });
  const chapters = parseWeebChapters(list);
  if (!chapters.length) return null;
  return {
    id: "weebcentral",
    label: "Weeb Central",
    chapters,
    notice: hostedChapterNotice(title, chapters, "Weeb Central") || "English chapter pages come from Weeb Central.",
  };
}

async function mangadexEnglishChapters(mangaId) {
  return cached(`md:en-chapters:${mangaId}`, async () => {
    const rows = await loadMangaDexFeed(mangaId, "en");
    return chapterEntries(hostedFeedRows(rows).filter((chapter) => chapter.attributes?.translatedLanguage === "en"));
  }, 10 * 60 * 1000);
}

async function mangadexReader(title) {
  const list = await mangadexList(1, title);
  const hit = bestTitleMatch(title, list.items, (item) => item.title);
  if (!hit) return null;
  const chapters = await mangadexEnglishChapters(parseCatalogId(hit.id).raw);
  if (!chapters.length) return null;
  return {
    id: "mangadex",
    label: "MangaDex",
    chapters,
    notice: hostedChapterNotice(title, chapters, "MangaDex") || "English chapter pages come from MangaDex.",
  };
}

// Indonesian Sanka comics. Each one is its own pill. English readers stay first.
// Komikstation search answers 500, so that source is opened by the title slug
// and kept only when the manga title matches. Kiryuu search ignores the query.
const COMIC_READERS = [
  { id: "bacakomik", label: "BacaKomik · Indonesian", shortName: "BacaKomik", detail: "detail" },
  { id: "komikindo", label: "Komikindo · Indonesian", shortName: "Komikindo", detail: "detail" },
  { id: "komikstation", label: "Komikstation · Indonesian", shortName: "Komikstation", detail: "manga" },
  { id: "mangakita", label: "MangaKita · Indonesian", shortName: "MangaKita", detail: "detail" },
];

function comicSearchRows(payload) {
  if (Array.isArray(payload?.komikList)) return payload.komikList;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.seriesList)) return payload.seriesList;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function comicChapterRows(payload) {
  const boxes = [payload?.detail, payload?.data, payload?.details, payload];
  for (const box of boxes) {
    if (Array.isArray(box?.chapters) && box.chapters.length) return box.chapters;
  }
  return [];
}

function comicTitleSlug(title) {
  return String(title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function comicChapterId(source, seriesSlug, row) {
  const number = readSankaChapterNumber(row);
  let slug = String(row?.slug || row?.chapter_id || "");
  if (source.id === "mangakita" && seriesSlug && number) slug = `${seriesSlug}-chapter-${number}`;
  if (!slug || slug.includes("mangapill:")) return "";
  if (source.id === "komikstation") return `komikstation:${slug}`;
  return `sanka:${source.id}:${slug}`;
}

async function comicSearch(sourceId, title) {
  try {
    const payload = await fetchJson(`${SANKA}/comic/${sourceId}/search/${encodeURIComponent(title)}`, { timeout: 8000 });
    const rows = comicSearchRows(payload)
      .map((row) => ({ title: cleanComicTitle(row.title), slug: row.slug }))
      .filter((row) => row.slug && row.title);
    return bestTitleMatch(title, rows, (row) => row.title);
  } catch {
    return null;
  }
}

async function loadComicReader(source, title) {
  let hit = await comicSearch(source.id, title);
  if (!hit?.slug && source.id === "komikstation") {
    const slug = comicTitleSlug(title);
    if (slug) hit = { title, slug };
  }
  if (!hit?.slug) return null;
  const path = source.detail === "manga"
    ? `/comic/${source.id}/manga/${encodeURIComponent(hit.slug)}`
    : `/comic/${source.id}/detail/${encodeURIComponent(hit.slug)}`;
  const payload = await fetchJson(`${SANKA}${path}`, { timeout: 8000 });
  const metaTitle = cleanComicTitle(
    payload?.detail?.title || payload?.data?.title || payload?.details?.title || payload?.title || hit.title
  );
  if (!bestTitleMatch(title, [{ title: metaTitle }], (row) => row.title)) return null;
  const chapters = [];
  const seen = new Set();
  comicChapterRows(payload).forEach((row) => {
    const id = comicChapterId(source, hit.slug, row);
    if (!id || seen.has(id)) return;
    seen.add(id);
    const number = readSankaChapterNumber(row);
    chapters.push({
      id,
      number: number || cleanComicTitle(row.title) || "Chapter",
      title: number ? `Chapter ${number}` : (cleanComicTitle(row.title) || "Chapter"),
      pages: 1,
    });
  });
  if (!chapters.length) return null;
  return {
    id: source.id,
    label: source.label,
    chapters,
    notice: hostedChapterNotice(title, chapters, source.shortName)
      || `Indonesian chapter pages come from ${source.shortName}.`,
  };
}

export function loadMangaSources(title) {
  const key = `manga-sources:${compactTitle(title)}`;
  return cached(key, async () => {
    const [english, dex, ...comics] = await Promise.all([
      weebReader(title).catch(() => null),
      mangadexReader(title).catch(() => null),
      ...COMIC_READERS.map((source) => loadComicReader(source, title).catch(() => null)),
    ]);
    const sources = [];
    if (english?.chapters?.length) sources.push(english);
    if (dex?.chapters?.length) sources.push(dex);
    comics.forEach((source) => {
      if (source?.chapters?.length) sources.push(source);
    });
    if (!sources.length) {
      const missed = new Error("No chapter pages");
      missed.noStore = true;
      throw missed;
    }
    return sources;
  }, 10 * 60 * 1000);
}

function nozuTitle(title) {
  if (!title) return "Untitled";
  if (typeof title === "string") return title;
  return title.english || title.romaji || title.native || "Untitled";
}

function nozuItem(row, kind) {
  const title = row.title;
  const names = title && typeof title === "object"
    ? titleBundle(nozuTitle(title), [title.romaji, title.english, title.native])
    : titleBundle(nozuTitle(title), []);
  return {
    id: `nozu:${row.slug}`,
    source: "nozu",
    title: names.title,
    altTitles: names.altTitles,
    image: row.cover_image || "",
    banner: row.banner_image || "",
    rating: row.average_score ?? null,
    description: plainText(row.description),
    episodeNumber: row.episodes || row.chapters || null,
    kind,
  };
}

async function nozuCollection(path, kind) {
  const payload = await fetchJson(`${NOZU}${path}`);
  const rows = Array.isArray(payload.data) ? payload.data : [];
  const page = Number(payload.meta?.current_page) || 1;
  const last = Number(payload.meta?.last_page) || 1;
  return {
    items: rows.filter((row) => row.slug && row.cover_image).map((row) => nozuItem(row, kind)),
    hasNext: page < last,
    source: "nozu",
  };
}

async function nozuAnimeDetail(slug) {
  const payload = await fetchJson(`${NOZU}/anime/${encodeURIComponent(slug)}`);
  const data = payload.data;
  if (!data?.title) return null;
  const item = nozuItem(data, "anime");
  const links = [];
  const seen = new Set();
  const seenSites = new Set();
  (data.external_links || []).forEach((link) => {
    if (link.type && link.type !== "STREAMING") return;
    const url = String(link.url || "").replace(/^http:\/\//i, "https://");
    const site = String(link.site || "Stream").trim();
    if (!url || seen.has(url) || seenSites.has(site.toLowerCase())) return;
    seen.add(url);
    seenSites.add(site.toLowerCase());
    links.push({ label: site, url });
  });
  (data.streaming_episodes || []).forEach((episode) => {
    const url = String(episode.url || "").replace(/^http:\/\//i, "https://");
    const site = String(episode.site || "").trim();
    if (!url || seen.has(url) || (site && seenSites.has(site.toLowerCase()))) return;
    seen.add(url);
    if (site) seenSites.add(site.toLowerCase());
    links.push({ label: site || episode.title || "Episode", url });
  });
  const trailer = data.trailer || {};
  const trailerId = String(trailer.site || "youtube").toLowerCase() === "youtube"
    ? (trailer.id || youtubeId(trailer.url || trailer.site))
    : "";
  const detail = {
    ...item,
    id: `nozu:${slug}`,
    episodes: [],
    chapters: [],
    watchLinks: links.slice(0, 8),
    preview: trailerId ? { label: "Trailer", embed: youtubeEmbed(trailerId) } : null,
    notice: "",
    kind: "anime",
  };
  remember([detail]);
  return detail;
}

async function nozuMangaDetail(slug) {
  const payload = await fetchJson(`${NOZU}/manga/${encodeURIComponent(slug)}`);
  const data = payload.data;
  if (!data?.title) return null;
  const item = nozuItem(data, "manga");
  let chapters = [];
  let notice = "Nozu has the catalog entry. Chapter pages load when another source matches this title.";
  try {
    const title = item.title;
    const found = await kiryuuSearch(title);
    const hit = found.items.find((entry) => playableTitle(title, entry.title) || sameWork(title, entry.title));
    if (hit) {
      const readable = await kiryuuDetail(parseCatalogId(hit.id).raw);
      if (readable?.chapters?.some((chapter) => chapter.id && chapter.pages)) {
        chapters = readable.chapters;
        notice = readable.notice || "Chapter pages come from Komikstation.";
      }
    }
  } catch {
    // The page source can still arrive from the reader buttons.
  }
  const detail = {
    ...item,
    id: `nozu:${slug}`,
    episodes: [],
    chapters,
    notice,
    kind: "manga",
  };
  remember([detail]);
  return detail;
}

async function getAnimeDetailFresh(catalogId) {
  const parsed = parseCatalogId(catalogId);
  const loaders = {
    anilist: (raw) => anilistDetail(raw, "ANIME"),
    kitsu: (raw) => kitsuAnimeDetail(raw),
    sanka: (raw) => sankaAnimeDetail(raw),
    nozu: (raw) => nozuAnimeDetail(raw),
  };
  try {
    if (!loaders[parsed.source]) throw new Error("Unknown anime source");
    const detail = await loaders[parsed.source](parsed.raw);
    if (!detail?.title) throw new Error("Anime title was not found");
    return enrichAnime(detail);
  } catch (error) {
    const fallback = await fallbackDetail(parsed, recall(parsed.id), searchAnime, loaders);
    if (fallback) return enrichAnime(fallback);
    throw error;
  }
}

async function enrichAnime(detail) {
  const [previewed, playable] = await Promise.all([
    attachPreview(detail),
    attachPlayableEpisodes(detail),
  ]);
  const episodes = playable.episodes || previewed.episodes || [];
  const malId = previewed.malId || playable.malId || null;
  const hasSanka = episodes.some((episode) => episode.episodeId);
  const canEmbed = Boolean(malId) || previewed.source === "anilist" || playable.source === "anilist";
  const notice = hasSanka
    ? (playable.notice || previewed.notice || "")
    : (canEmbed
      ? "No Sanka stream is listed. Players below can try this episode."
      : (playable.notice || previewed.notice || ""));
  return {
    ...previewed,
    episodes,
    notice,
    preview: previewed.preview || playable.preview || null,
    malId,
    watchLinks: previewed.watchLinks || playable.watchLinks || [],
  };
}

// MangaDex, AniList (isAdult: false), Kitsu, and Nozu are Japanese manga catalogs.
// Kiryuu's home feed is mostly manhwa, so it stays later for Komikstation matches.
async function listMangaFresh(page = 1) {
  return firstList([
    () => mangadexList(page),
    () => anilistPage({ type: "MANGA", page, sort: "POPULARITY_DESC" }),
    () => kitsuCollection(kitsuListPath("manga", "popular", page), "manga"),
    () => nozuCollection("/popular?type=manga", "manga"),
    () => kiryuuList(page),
  ]);
}

async function searchMangaFresh(query, page = 1) {
  const jobs = [
    mangadexList(page, query)
      .then((result) => ({ source: "mangadex", priority: 2, items: result.items, hasNext: result.hasNext }))
      .catch(() => ({ source: "mangadex", priority: 2, items: [] })),
    anilistPage({ type: "MANGA", page, sort: "SEARCH_MATCH", search: query })
      .then((result) => ({ source: "anilist", priority: 3, items: result.items, hasNext: result.hasNext }))
      .catch(() => ({ source: "anilist", priority: 3, items: [] })),
  ];
  if (page === 1) {
    jobs.unshift(
      weebCatalog(query)
        .then((items) => ({ source: "weebcentral", priority: 1, items }))
        .catch(() => ({ source: "weebcentral", priority: 1, items: [] })),
    );
    jobs.push(
      kiryuuSearch(query)
        .then((result) => ({ source: "kiryuu", priority: 0, items: result.items }))
        .catch(() => ({ source: "kiryuu", priority: 0, items: [] })),
    );
  }
  const lists = await Promise.all(jobs);
  const items = rankMangaSearch(query, lists);
  remember(items);
  return {
    items,
    hasNext: lists.some((list) => list.hasNext),
    source: items[0]?.source || "",
  };
}

function withBareMangaId(catalogId) {
  const parsed = parseCatalogId(catalogId);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!parsed.source && uuid.test(parsed.raw)) {
    return { source: "mangadex", raw: parsed.raw, id: `mangadex:${parsed.raw}` };
  }
  return parsed;
}

function hasReadableChapters(chapters) {
  return (chapters || []).some((chapter) => {
    const id = String(chapter?.id || "");
    return Boolean(chapter?.pages) && id && !id.startsWith("mangapill:");
  });
}

async function withReadableChapters(detail) {
  if (!detail?.title) return detail;
  const placeholder = ["anilist", "kitsu", "nozu"].includes(detail.source);
  if (!placeholder || hasReadableChapters(detail.chapters)) return detail;
  try {
    const sources = await loadMangaSources(detail.title);
    const readable = (sources || []).find((source) => hasReadableChapters(source.chapters));
    if (!readable) return detail;
    return {
      ...detail,
      chapters: readable.chapters,
      notice: readable.notice || detail.notice,
    };
  } catch {
    return detail;
  }
}

async function getMangaDetailFresh(catalogId) {
  const parsed = withBareMangaId(catalogId);
  const loaders = {
    mangadex: (raw) => mangadexDetail(raw),
    kitsu: (raw) => kitsuMangaDetail(raw),
    anilist: (raw) => anilistDetail(raw, "MANGA"),
    kiryuu: (raw) => kiryuuDetail(raw),
    komikstation: (raw) => komikstationDetail(raw),
    weebcentral: (raw) => weebDetail(raw),
    sanka: (raw) => sankaComicDetail(raw),
    nozu: (raw) => nozuMangaDetail(raw),
  };
  try {
    if (!loaders[parsed.source]) throw new Error("Unknown manga source");
    return await withReadableChapters(await loaders[parsed.source](parsed.raw));
  } catch (error) {
    const fallback = await fallbackDetail(parsed, recall(parsed.id), searchManga, loaders);
    if (fallback) return withReadableChapters(fallback);
    throw error;
  }
}

const TMDB_KEY = "152f41397d36a9af171b938124f0281c";

export function listAnime(preset, page = 1, fresh = false) {
  return cached(`anime:${preset}:${page}`, () => listAnimeFresh(preset, page), LIST_TTL, fresh);
}

export function searchAnime(query, page = 1, fresh = false) {
  const q = String(query || "").trim();
  return cached(`anime-search:${q.toLowerCase()}:${page}`, () => searchAnimeFresh(q, page), LIST_TTL, fresh);
}

export function getAnimeDetail(catalogId, fresh = false) {
  return cached(`anime-detail:${catalogId}`, () => getAnimeDetailFresh(catalogId), DETAIL_TTL, fresh);
}

export function listManga(page = 1, fresh = false) {
  return cached(`manga:${page}`, () => listMangaFresh(page), LIST_TTL, fresh);
}

export function searchManga(query, page = 1, fresh = false) {
  const q = String(query || "").trim();
  return cached(`manga-search:${q.toLowerCase()}:${page}`, () => searchMangaFresh(q, page), LIST_TTL, fresh);
}

export function getMangaDetail(catalogId, fresh = false) {
  return cached(`manga-detail:${catalogId}`, () => getMangaDetailFresh(catalogId), DETAIL_TTL, fresh);
}

export function loadTmdbList({ kind, path, page = 1, search = "", fresh = false }) {
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
  }, LIST_TTL, fresh);
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

export function loadPokemon(page = 1, search = "", fresh = false) {
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
  }, LIST_TTL, fresh);
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
