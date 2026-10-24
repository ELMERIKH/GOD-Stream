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
