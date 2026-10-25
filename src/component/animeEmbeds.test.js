import { animeEmbedOptions, firstAnimeEmbed, isPaidStoreLink } from "./animeEmbeds";

test("a missing host url is skipped and the next embed is used", () => {
  const anilistOnly = animeEmbedOptions({ malId: null, anilistId: 195516, episode: 2 });
  expect(anilistOnly.map((host) => host.id)).toEqual(["vidcloud"]);
  expect(firstAnimeEmbed(anilistOnly).url).toBe("https://vidcloud.sbs/embed/ani/195516/2/sub");

  const withMal = animeEmbedOptions({ malId: 61987, anilistId: 195516, episode: 2 });
  expect(withMal.map((host) => host.id)).toEqual(["vidcloud", "vidlink", "videasy", "vidsrc"]);
  expect(firstAnimeEmbed(withMal).id).toBe("vidcloud");
  expect(withMal.find((host) => host.id === "vidsrc").url).toBe(
    "https://vidsrc.me/embed/anime/mal/61987/2"
  );
  expect(firstAnimeEmbed(withMal, "missing").id).toBe("vidcloud");
  expect(firstAnimeEmbed(withMal, "vidlink").url).toContain("vidlink.pro/anime/61987/2/sub");
  expect(firstAnimeEmbed([
    { id: "vidsrc", label: "VidSrc", url: "" },
    { id: "vidcloud", label: "VidCloud", url: "https://vidcloud.sbs/embed/mal/61987/2/sub" },
  ], "vidsrc").id).toBe("vidcloud");
});

test("paid official links are not player sources", () => {
  expect(isPaidStoreLink({ label: "Crunchyroll", url: "https://www.crunchyroll.com/series/x" })).toBe(true);
  expect(isPaidStoreLink({ label: "Funimation", url: "https://www.funimation.com/shows/x" })).toBe(true);
  expect(isPaidStoreLink({ label: "Netflix", url: "https://www.netflix.com/title/1" })).toBe(true);
  expect(isPaidStoreLink({ label: "Hulu", url: "https://www.hulu.com/series/x" })).toBe(true);
  expect(isPaidStoreLink({ label: "VidCloud", url: "https://vidcloud.sbs/embed/mal/21/1/sub" })).toBe(false);
});

test("a missing Sanka embed still yields the four free embed URLs", () => {
  const hosts = animeEmbedOptions({ malId: 21, anilistId: 21, episode: 1180 });
  expect(hosts.map((host) => host.id)).toEqual(["vidcloud", "vidlink", "videasy", "vidsrc"]);
  expect(hosts.map((host) => host.url)).toEqual([
    "https://vidcloud.sbs/embed/mal/21/1180/sub",
    "https://vidlink.pro/anime/21/1180/sub?fallback=true",
    "https://player.videasy.to/anime/21/1180",
    "https://vidsrc.me/embed/anime/mal/21/1180",
  ]);
  expect(firstAnimeEmbed(hosts).id).toBe("vidcloud");
  expect(hosts.every((host) => host.url)).toBe(true);
});

test("an empty episode list does not invent an embed", () => {
  expect(animeEmbedOptions({ malId: 61987, episode: 0 })).toEqual([]);
  expect(firstAnimeEmbed([])).toBeNull();
});
