import {
  clearCatalogCache,
  getAnimeDetail,
  getMangaDetail,
  getMangaPages,
  listAnime,
  listManga,
  loadEpisodeEmbed,
  loadEpisodeServers,
} from "./catalog";

function jsonResponse(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

beforeEach(() => {
  clearCatalogCache();
  sessionStorage.clear();
  global.fetch = jest.fn();
});

test("listManga keeps Kiryuu when it returns covers", async () => {
  global.fetch.mockImplementation((url) => {
    if (String(url).includes("/comic/kiryuu/home")) {
      return jsonResponse({
        trending: [
          {
            slug: "martial-peak",
            title: "Martial Peak",
            imageSrc: "https://v7.kiryuu.to/cover.jpg",
            rating: "8.5",
          },
        ],
      });
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  });

  const result = await listManga(1);
  expect(result.source).toBe("kiryuu");
  expect(result.items[0].id).toBe("kiryuu:martial-peak");
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test("listManga continues when Kiryuu is empty", async () => {
  global.fetch.mockImplementation((url) => {
    const href = String(url);
    if (href.includes("/comic/kiryuu/home")) return jsonResponse({ trending: [] });
    if (href.includes("api.mangadex.org")) return jsonResponse({}, 500);
    if (href.includes("kitsu.io")) {
      return jsonResponse({
        data: [
          {
            id: "9",
            attributes: {
              canonicalTitle: "Bee",
              posterImage: { medium: "https://media.kitsu.app/bee.jpg" },
            },
          },
        ],
      });
    }
    return Promise.reject(new Error(`unexpected ${href}`));
  });

  const result = await listManga(1);
  expect(result.source).toBe("kitsu");
  expect(result.items[0].title).toBe("Bee");
});

test("listAnime uses AniList covers before the Sanka poster host", async () => {
  global.fetch.mockImplementation((url) => {
    if (String(url).includes("graphql.anilist.co")) {
      return jsonResponse({
        data: {
          Page: {
            pageInfo: { hasNextPage: true },
            media: [
              {
                id: 20,
                title: { romaji: "Naruto", english: "Naruto" },
                coverImage: { large: "https://s4.anilist.co/naruto.jpg" },
                averageScore: 80,
              },
            ],
          },
        },
      });
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  });

  const result = await listAnime("recent", 1);
  expect(result.source).toBe("anilist");
  expect(result.items[0].image).toContain("anilist.co");
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test("getMangaPages reads Komikstation images and caches them", async () => {
  global.fetch.mockResolvedValue(
    jsonResponse({
      images: [
        "https://img.klikcdn.com/page-1.jpg",
        "https://img.klikcdn.com/page-2.jpg",
      ],
    })
  );

  const first = await getMangaPages("komikstation:martial-peak-chapter-3862");
  const second = await getMangaPages("komikstation:martial-peak-chapter-3862");
  expect(first).toEqual([
    "https://img.klikcdn.com/page-1.jpg",
    "https://img.klikcdn.com/page-2.jpg",
  ]);
  expect(second).toEqual(first);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test("anime detail attaches Sanka episodes and prefers a filedon player", async () => {
  global.fetch.mockImplementation((url) => {
    const href = String(url);
    if (href.includes("graphql.anilist.co")) {
      return jsonResponse({
        data: {
          Media: {
            id: 1,
            title: { romaji: "Naruto", english: "Naruto" },
            description: "A ninja",
            coverImage: { extraLarge: "https://s4.anilist.co/naruto.jpg" },
            averageScore: 80,
            episodes: 1,
            streamingEpisodes: [],
          },
        },
      });
    }
    if (href.includes("/anime/search/")) {
      return jsonResponse({
        data: {
          animeList: [{ animeId: "naruto-sub-indo", title: "Naruto", poster: "" }],
        },
      });
    }
    if (href.includes("/anime/anime/")) {
      return jsonResponse({
        data: {
          title: "Naruto",
          poster: "",
          synopsis: { paragraphs: ["A ninja"] },
          episodeList: [{ eps: "1", episodeId: "naruto-episode-1" }],
        },
      });
    }
    if (href.includes("/anime/episode/")) {
      return jsonResponse({
        data: {
          defaultStreamingUrl: "https://desustream.net/embed/blocked",
          server: {
            qualities: [
              {
                serverList: [
                  { title: "desustream", serverId: "desu" },
                  { title: "filedon", serverId: "file-1" },
                ],
              },
            ],
          },
        },
      });
    }
    if (href.includes("/anime/server/file-1")) {
      return jsonResponse({ data: { url: "https://filedon.co/embed/abc" } });
    }
    return Promise.reject(new Error(`unexpected ${href}`));
  });

  const detail = await getAnimeDetail("anilist:1");
  expect(detail.episodes[0].episodeId).toBe("naruto-episode-1");
  expect(detail.image).toContain("anilist.co");
  expect(detail.notice).toMatch(/Sanka/);

  const embed = await loadEpisodeEmbed("naruto-episode-1");
  expect(embed).toBe("https://filedon.co/embed/abc");
  const again = await loadEpisodeEmbed("naruto-episode-1");
  expect(again).toBe(embed);
  const episodeCalls = global.fetch.mock.calls.filter((call) =>
    String(call[0]).includes("/anime/episode/")
  );
  expect(episodeCalls).toHaveLength(1);
});

test("a bare manga uuid opens through MangaDex", async () => {
  global.fetch.mockImplementation((url) => {
    const href = String(url);
    if (href.includes("/feed")) return jsonResponse({ result: "ok", data: [] });
    if (href.includes("/manga/04f6660b-0018-452d-844a-a205594dd66d")) {
      return jsonResponse({
        result: "ok",
        data: {
          id: "04f6660b-0018-452d-844a-a205594dd66d",
          attributes: { title: { en: "Old Link" }, description: {} },
          relationships: [],
        },
      });
    }
    return Promise.reject(new Error(`unexpected ${href}`));
  });

  const detail = await getMangaDetail("04f6660b-0018-452d-844a-a205594dd66d");
  expect(detail.source).toBe("mangadex");
  expect(detail.title).toBe("Old Link");
});

test("episode source buttons keep the highest quality for each server", async () => {
  global.fetch.mockImplementation((url) => {
    const href = String(url);
    if (href.includes("/anime/episode/")) {
      return jsonResponse({
        data: {
          server: {
            qualities: [
              {
                title: "360p",
                serverList: [
                  { title: "filedon", serverId: "low" },
                  { title: "vidhide", serverId: "vh" },
                ],
              },
              {
                title: "720p",
                serverList: [
                  { title: "filedon", serverId: "high" },
                  { title: "mega", serverId: "mg" },
                ],
              },
            ],
          },
        },
      });
    }
    if (href.includes("/anime/server/high")) {
      return jsonResponse({ data: { url: "https://filedon.co/embed/high" } });
    }
    return Promise.reject(new Error(`unexpected ${href}`));
  });

  const servers = await loadEpisodeServers("ep-1");
  expect(servers.map((server) => server.label)).toEqual(["filedon 720p", "vidhide 360p", "mega 720p"]);
  expect(await loadEpisodeEmbed("ep-1")).toBe("https://filedon.co/embed/high");
});

test("embed skips hosts that refuse iframes", async () => {
  global.fetch.mockImplementation((url) => {
    const href = String(url);
    if (href.includes("/anime/episode/")) {
      return jsonResponse({
        data: {
          server: {
            qualities: [
              {
                title: "720p",
                serverList: [
                  { title: "filedon", serverId: "bad" },
                  { title: "vidhide", serverId: "good" },
                ],
              },
            ],
          },
        },
      });
    }
    if (href.includes("/anime/server/bad")) {
      return jsonResponse({ data: { url: "https://desustream.com/maintenance/" } });
    }
    if (href.includes("/anime/server/good")) {
      return jsonResponse({ data: { url: "https://odvidhide.com/embed/ok" } });
    }
    return Promise.reject(new Error(`unexpected ${href}`));
  });

  expect(await loadEpisodeEmbed("ep-blocked")).toBe("https://odvidhide.com/embed/ok");
});

test("anime detail matches Sanka on an alternate title and stops there", async () => {
  const searches = [];
  global.fetch.mockImplementation((url) => {
    const href = String(url);
    if (href.includes("graphql.anilist.co")) {
      return jsonResponse({
        data: {
          Media: {
            id: 16498,
            idMal: 16498,
            title: { romaji: "Shingeki no Kyojin", english: "Attack on Titan", native: "進撃の巨人" },
            description: "Walls",
            coverImage: { extraLarge: "https://s4.anilist.co/aot.jpg" },
            averageScore: 85,
            episodes: 1,
            streamingEpisodes: [],
          },
        },
      });
    }
    if (href.includes("/anime/search/")) {
      const query = decodeURIComponent(href.split("/anime/search/")[1]);
      searches.push(query);
      if (query === "Shingeki no Kyojin") {
        return jsonResponse({
          data: {
            animeList: [{ animeId: "shingeki-no-kyojin", title: "Shingeki no Kyojin", poster: "" }],
          },
        });
      }
      return jsonResponse({ data: { animeList: [] } });
    }
    if (href.includes("/anime/anime/")) {
      return jsonResponse({
        data: {
          title: "Shingeki no Kyojin",
          poster: "",
          synopsis: { paragraphs: ["Walls"] },
          episodeList: [{ eps: "1", episodeId: "snk-episode-1" }],
        },
      });
    }
    if (href.includes("shikimori.io")) return jsonResponse([]);
    return Promise.reject(new Error(`unexpected ${href}`));
  });

  const detail = await getAnimeDetail("anilist:16498");
  expect(detail.malId).toBe(16498);
  expect(detail.episodes[0].episodeId).toBe("snk-episode-1");
  expect(searches).toEqual(["Attack on Titan", "Shingeki no Kyojin"]);
});

test("an earlier catalog source still wins when a later one answers first", async () => {
  let release = () => {};
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  global.fetch.mockImplementation((url) => {
    const href = String(url);
    if (href.includes("/comic/kiryuu/home")) {
      return gate.then(() => jsonResponse({
        trending: [
          {
            slug: "martial-peak",
            title: "Martial Peak",
            imageSrc: "https://v7.kiryuu.to/cover.jpg",
            rating: "8.5",
          },
        ],
      }));
    }
    if (href.includes("nozu.me")) {
      return jsonResponse({
        data: [{ slug: "other", title: "Other", cover_image: "https://cdn.example/cover.jpg" }],
        meta: { current_page: 1, last_page: 1 },
      });
    }
    return Promise.reject(new Error(`unexpected ${href}`));
  });

  const pending = listManga(1);
  try {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 800));
    const urls = global.fetch.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes("/comic/kiryuu/home"))).toBe(true);
    expect(urls.some((url) => url.includes("nozu.me"))).toBe(true);
    release();
    const result = await pending;
    expect(result.source).toBe("kiryuu");
    expect(result.items[0].id).toBe("kiryuu:martial-peak");
  } finally {
    release();
  }
});

test("anilist official streaming sites stay as watch links", async () => {
  global.fetch.mockImplementation((url) => {
    const href = String(url);
    if (href.includes("graphql.anilist.co")) {
      return jsonResponse({
        data: {
          Media: {
            id: 195516,
            idMal: 61987,
            title: { romaji: "Kusuriya no Hitorigoto 3rd Season", english: "The Apothecary Diaries Season 3" },
            description: "Maomao",
            coverImage: { extraLarge: "https://s4.anilist.co/apo.jpg" },
            averageScore: 85,
            episodes: 12,
            trailer: { id: "YvNvvUeCztE", site: "youtube" },
            streamingEpisodes: [],
            externalLinks: [
              { site: "Crunchyroll", url: "https://www.crunchyroll.com/series/G3KHEVDJ7/the-apothecary-diaries", type: "STREAMING" },
              { site: "Netflix", url: "http://www.netflix.com/us/title/81712068", type: "STREAMING" },
              { site: "Twitter", url: "https://twitter.com/kusuriya_PR", type: "SOCIAL" },
            ],
          },
        },
      });
    }
    if (href.includes("/anime/search/")) return jsonResponse({ data: { animeList: [] } });
    return Promise.reject(new Error(`unexpected ${href}`));
  });

  const detail = await getAnimeDetail("anilist:195516");
  expect(detail.malId).toBe(61987);
  expect(detail.episodes).toHaveLength(12);
  expect(detail.watchLinks.map((link) => link.label)).toEqual(["Crunchyroll", "Netflix"]);
  expect(detail.watchLinks[1].url).toMatch(/^https:\/\//);
  expect(detail.preview.embed).toContain("YvNvvUeCztE");
  expect(detail.notice).toMatch(/No Sanka stream/);
});

test("a failed refresh keeps the last anime list and retry bypasses it", async () => {
  let fail = false;
  global.fetch.mockImplementation((url) => {
    if (fail) return Promise.reject(new Error("down"));
    if (String(url).includes("graphql.anilist.co")) {
      return jsonResponse({
        data: {
          Page: {
            pageInfo: { hasNextPage: false },
            media: [
              {
                id: 20,
                title: { romaji: "Naruto", english: "Naruto" },
                coverImage: { large: "https://s4.anilist.co/naruto.jpg" },
                averageScore: 80,
              },
            ],
          },
        },
      });
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  });

  const first = await listAnime("recent", 1);
  expect(first.stale).toBe(false);
  expect(first.items[0].title).toBe("Naruto");

  fail = true;
  const now = Date.now;
  Date.now = () => now() + 11 * 60 * 1000;
  try {
    const second = await listAnime("recent", 1);
    expect(second.stale).toBe(true);
    expect(second.items[0].title).toBe("Naruto");
    const callsBeforeRetry = global.fetch.mock.calls.length;
    fail = false;
    const third = await listAnime("recent", 1, true);
    expect(third.stale).toBe(false);
    expect(third.items[0].title).toBe("Naruto");
    expect(global.fetch.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
  } finally {
    Date.now = now;
  }
});
