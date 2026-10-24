const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { createServer } = require("./server");

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
    const anime = await request(port, "/Anime/anilist%3A21");
    const asset = await request(port, "/static/app.js");
    const missing = await request(port, "/static/missing.js");
    assert.equal(home.status, 200);
    assert.match(home.body, /StreamGod/);
    assert.equal(manga.status, 200);
    assert.match(manga.body, /StreamGod/);
    assert.equal(anime.status, 200);
    assert.equal(asset.status, 200);
    assert.match(asset.body, /console.log/);
    assert.equal(missing.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
