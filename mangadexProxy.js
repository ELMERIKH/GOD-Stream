const https = require("https");
const { URL } = require("url");

const API_HOST = "api.mangadex.org";
const API_PREFIX = "/api/mangadex";
const IMAGE_PATH = "/api/mangadex-image";
const FEED_PREFIXES = ["/manga", "/chapter", "/at-home/server/", "/cover"];

function isMangaDexApiPath(pathname) {
  return pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);
}

function isMangaDexImagePath(pathname) {
  return pathname === IMAGE_PATH;
}

function apiUpstream(pathname, search = "") {
  if (!isMangaDexApiPath(pathname)) return null;
  let rest = pathname.slice(API_PREFIX.length) || "/";
  if (!rest.startsWith("/")) rest = `/${rest}`;
  if (rest.includes("..") || rest.includes("\\") || rest.includes("//")) return null;
  const allowed = FEED_PREFIXES.some((prefix) => rest === prefix || rest.startsWith(prefix));
  if (!allowed) return null;
  const query = search && !search.startsWith("?") ? `?${search}` : (search || "");
  return `https://${API_HOST}${rest}${query}`;
}

function imageTarget(raw) {
  if (!raw || String(raw).length > 2000) return null;
  let parsed;
  try {
    parsed = new URL(String(raw));
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;
  if (parsed.port && parsed.port !== "443") return null;
  const host = parsed.hostname.toLowerCase();
  const uploads = host === "uploads.mangadex.org";
  const atHome = host.endsWith(".mangadex.network") && host !== "mangadex.network" && !host.startsWith(".");
  if (!uploads && !atHome) return null;
  const path = parsed.pathname || "";
  if (path.includes("..") || path.includes("\\") || path.includes("//")) return null;
  const allowedPath = path.startsWith("/data/") || path.startsWith("/data-saver/") || path.startsWith("/covers/");
  if (!allowedPath) return null;
  return parsed;
}

function sameImageHost(nextUrl, currentUrl) {
  const next = imageTarget(nextUrl);
  const current = imageTarget(currentUrl);
  if (!next || !current) return false;
  return next.hostname === current.hostname;
}

function sendText(res, status, body) {
  if (res.writableEnded || res.headersSent) return;
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

function pipeGet(targetUrl, res, redirectsLeft, accept) {
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    sendText(res, 400, "MangaDex address was rejected");
    return;
  }
  const request = https.request({
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    path: `${parsed.pathname}${parsed.search}`,
    method: "GET",
    headers: {
      Accept: accept,
      "User-Agent": "StreamGod",
    },
    timeout: 12000,
  }, (upstream) => {
    const location = upstream.headers.location;
    if ([301, 302, 303, 307, 308].includes(upstream.statusCode) && location && redirectsLeft > 0) {
      upstream.resume();
      const next = new URL(location, targetUrl).toString();
      const stayingOnApi = parsed.hostname === API_HOST && next.startsWith(`https://${API_HOST}/`);
      if (!stayingOnApi && !sameImageHost(next, targetUrl)) {
        sendText(res, 502, "Upstream redirect was rejected");
        return;
      }
      pipeGet(next, res, redirectsLeft - 1, accept);
      return;
    }
    const headers = {
      "Content-Type": upstream.headers["content-type"] || "application/octet-stream",
      "Cache-Control": upstream.headers["cache-control"] || "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    };
    if (upstream.headers["content-length"]) headers["Content-Length"] = upstream.headers["content-length"];
    res.writeHead(upstream.statusCode || 502, headers);
    upstream.pipe(res);
  });
  request.on("timeout", () => request.destroy());
  request.on("error", () => sendText(res, 502, "MangaDex proxy failed"));
  request.end();
}

function handleMangaDexProxy(req, res) {
  const method = String(req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    sendText(res, 405, "Method not allowed");
    return;
  }
  let pathname = "/";
  let search = "";
  try {
    const parsed = new URL(req.url || "/", "http://localhost");
    pathname = parsed.pathname;
    search = parsed.search || "";
  } catch {
    sendText(res, 400, "Bad request");
    return;
  }
  if (isMangaDexImagePath(pathname)) {
    const target = imageTarget(new URL(req.url, "http://localhost").searchParams.get("url"));
    if (!target) {
      sendText(res, 400, "Image host was rejected");
      return;
    }
    if (method === "HEAD") {
      sendText(res, 200, "");
      return;
    }
    pipeGet(target.toString(), res, 2, "image/avif,image/webp,image/*,*/*");
    return;
  }
  const upstream = apiUpstream(pathname, search);
  if (!upstream) {
    sendText(res, 404, "Not Found");
    return;
  }
  if (method === "HEAD") {
    sendText(res, 200, "");
    return;
  }
  pipeGet(upstream, res, 2, "application/json");
}

module.exports = {
  API_PREFIX,
  IMAGE_PATH,
  apiUpstream,
  handleMangaDexProxy,
  imageTarget,
  isMangaDexApiPath,
  isMangaDexImagePath,
};
