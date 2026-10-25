const http = require("http");
const fs = require("fs");
const path = require("path");
const { handleMangaDexProxy, isMangaDexApiPath, isMangaDexImagePath } = require("./mangadexProxy");
const { handleWeebProxy, isWeebApiPath, isWeebImagePath } = require("./weebProxy");

const root = path.resolve(process.env.STATIC_ROOT || path.join(__dirname, "build"));
const indexFile = path.join(root, "index.html");
const port = Number(process.env.PORT) || 10000;

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function contentType(file) {
  return types[path.extname(file).toLowerCase()] || "application/octet-stream";
}

function sendFile(res, status, file) {
  const hashed = file.includes(`${path.sep}static${path.sep}`);
  res.writeHead(status, {
    "Content-Type": contentType(file),
    "Cache-Control": hashed ? "public, max-age=31536000, immutable" : "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
  fs.createReadStream(file).pipe(res);
}

function createServer(directory = root) {
  const base = path.resolve(directory);
  const fallback = path.join(base, "index.html");
  return http.createServer((req, res) => {
    let pathname = "/";
    try {
      pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Bad Request");
      return;
    }
    if (isMangaDexApiPath(pathname) || isMangaDexImagePath(pathname)) {
      handleMangaDexProxy(req, res);
      return;
    }
    if (isWeebApiPath(pathname) || isWeebImagePath(pathname)) {
      handleWeebProxy(req, res);
      return;
    }
    const requested = path.normalize(path.join(base, pathname));
    if (requested !== base && !requested.startsWith(base + path.sep)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }
    fs.stat(requested, (error, stat) => {
      if (!error && stat.isFile()) {
        sendFile(res, 200, requested);
        return;
      }
      if (!error && stat.isDirectory()) {
        const nested = path.join(requested, "index.html");
        fs.stat(nested, (nestedError, nestedStat) => {
          if (!nestedError && nestedStat.isFile()) {
            sendFile(res, 200, nested);
            return;
          }
          sendFile(res, 200, fallback);
        });
        return;
      }
      if (path.extname(pathname)) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not Found");
        return;
      }
      sendFile(res, 200, fallback);
    });
  });
}

if (require.main === module) {
  createServer(root).listen(port, () => {
    console.log(`StreamGod listening on ${port}`);
  });
}

module.exports = { createServer };
