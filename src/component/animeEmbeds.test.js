import { animeEmbedOptions, firstAnimeEmbed } from "./animeEmbeds";

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

test("an empty episode list does not invent an embed", () => {
  expect(animeEmbedOptions({ malId: 61987, episode: 0 })).toEqual([]);
  expect(firstAnimeEmbed([])).toBeNull();
});
