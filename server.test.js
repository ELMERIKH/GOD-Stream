const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { createServer } = require("./server");
const { apiUpstream, imageTarget } = require("./mangadexProxy");

function request(port, urlPath) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: "127.0.0.1", port, path: urlPath }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8"), type: res.headers["content-type"] }));
    }).on("error", reject);
  });
}

test("deep links return the app and missing assets stay 404", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "streamgod-"));
  fs.mkdirSync(path.join(directory, "static"));
  fs.writeFileSync(path.join(directory, "index.html"), "<div id=\"root\">StreamGod</div>");
  fs.writeFileSync(path.join(directory, "static", "app.js"), "console.log(1)");
  const server = createServer(directory);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const home = await request(port, "/");
    const manga = await request(port, "/Manga/04f6660b-0018-452d-844a-a205594dd66d");
    const anime = await request(port, "/Anime/anilist%3A195516");
    const encodedManga = await request(port, "/Manga/kiryuu%3Amartial-peak");
    const asset = await request(port, "/static/app.js");
    const missing = await request(port, "/static/missing.js");
    assert.equal(home.status, 200);
    assert.match(home.type, /text\/html/);
    assert.match(home.body, /StreamGod/);
    assert.equal(manga.status, 200);
    assert.match(manga.type, /text\/html/);
    assert.match(manga.body, /StreamGod/);
    assert.equal(anime.status, 200);
    assert.match(anime.type, /text\/html/);
    assert.match(anime.body, /StreamGod/);
    assert.notEqual(anime.body, "Not Found");
    assert.equal(encodedManga.status, 200);
    assert.match(encodedManga.body, /StreamGod/);
    assert.equal(asset.status, 200);
    assert.match(asset.body, /console.log/);
    assert.equal(missing.status, 404);
    assert.equal(missing.body, "Not Found");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("MangaDex proxy allowlist accepts API reads and at-home images only", () => {
  assert.equal(
    apiUpstream("/api/mangadex/manga", "?limit=1"),
    "https://api.mangadex.org/manga?limit=1"
  );
  assert.equal(
    apiUpstream("/api/mangadex/at-home/server/abc", ""),
    "https://api.mangadex.org/at-home/server/abc"
  );
  assert.equal(apiUpstream("/api/mangadex/account/me", ""), null);
  assert.equal(apiUpstream("/api/other", ""), null);
  assert.equal(apiUpstream("/api/mangadex/manga/../../secret", ""), null);

  assert.ok(imageTarget("https://cmdxd98sb0x3yprd.mangadex.network/data-saver/abc/1.jpg"));
  assert.ok(imageTarget("https://uploads.mangadex.org/covers/id/file.jpg"));
  assert.equal(imageTarget("https://mangapill.com/a.jpg"), null);
  assert.equal(imageTarget("https://cdn.readdetectiveconan.com/a.jpg"), null);
  assert.equal(imageTarget("http://uploads.mangadex.org/covers/id/file.jpg"), null);
  assert.equal(imageTarget("https://api.mangadex.org/covers/id/file.jpg"), null);
  assert.equal(imageTarget("https://uploads.mangadex.org/auth/secret"), null);
  assert.equal(imageTarget("https://evil.example/data/a.jpg"), null);
});

test("rejected MangaDex image hosts do not fall through to the app shell", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "streamgod-"));
  fs.writeFileSync(path.join(directory, "index.html"), "<div id=\"root\">StreamGod</div>");
  const server = createServer(directory);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const rejected = await request(port, "/api/mangadex-image?url=https%3A%2F%2Fmangapill.com%2Fa.jpg");
    const account = await request(port, "/api/mangadex/account/me");
    assert.equal(rejected.status, 400);
    assert.equal(rejected.body, "Image host was rejected");
    assert.doesNotMatch(rejected.body, /StreamGod/);
    assert.equal(account.status, 404);
    assert.equal(account.body, "Not Found");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
