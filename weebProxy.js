const https = require("https");
const { spawn } = require("child_process");
const { URL } = require("url");

const API_PREFIX = "/api/weebcentral";
const IMAGE_PATH = "/api/weeb-image";
const HOST = "weebcentral.com";
const SERIES_ID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const PAGE_HOSTS = new Set(["scans-hot.planeptune.us", "scans.lastation.us", "official.lowee.us"]);

function isWeebApiPath(pathname) {
  return pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);
}

function isWeebImagePath(pathname) {
  return pathname === IMAGE_PATH;
}

function weebUpstream(pathname, search = "") {
  if (!isWeebApiPath(pathname)) return null;
  let rest = pathname.slice(API_PREFIX.length) || "/";
  if (!rest.startsWith("/")) rest = `/${rest}`;
  if (rest.includes("..") || rest.includes("\\") || rest.includes("//")) return null;
  const query = search && !search.startsWith("?") ? `?${search}` : (search || "");
  if (query.length > 2000) return null;
  if (rest === "/search/data") {
    const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
    if ((params.get("text") || "").length > 200) return null;
    params.set("adult", "False");
    return `https://${HOST}/search/data?${params.toString()}`;
  }
  const series = rest.match(/^\/series\/([0-9A-HJKMNP-TV-Z]{26})(\/full-chapter-list)?$/);
  const chapter = rest.match(/^\/chapters\/([0-9A-HJKMNP-TV-Z]{26})\/images$/);
  if (series && !SERIES_ID.test(series[1])) return null;
  if (chapter && !SERIES_ID.test(chapter[1])) return null;
  if (!series && !chapter) return null;
  return `https://${HOST}${rest}${query}`;
}

function weebImageTarget(raw) {
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
  if (!PAGE_HOSTS.has(host)) return null;
  const path = parsed.pathname || "";
  if (path.includes("..") || path.includes("\\") || path.includes("//")) return null;
  if (!path.startsWith("/manga/")) return null;
  if (/mangapill|readdetectiveconan/i.test(`${host}${path}`)) return null;
  return parsed;
}

function sniffType(buffer, fallback) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "image/png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buffer.length >= 3 && buffer.toString("ascii", 0, 3) === "GIF") return "image/gif";
  return fallback || "application/octet-stream";
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

// weebcentral.com answers Node's HTTPS client with a Cloudflare interstitial.
// Python's HTTP client receives the public HTML, so chapter lists are read that way.
// Image files stay on the allowlisted CDNs and are not fetched here.
const WEEB_FETCH = `
import sys, urllib.request
url = sys.argv[1]
class Stay(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not str(newurl).startswith("https://weebcentral.com/"):
            raise urllib.error.HTTPError(req.full_url, 502, "redirect rejected", headers, fp)
        return super().redirect_request(req, fp, code, msg, headers, newurl)
opener = urllib.request.build_opener(Stay)
request = urllib.request.Request(url, headers={
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
})
with opener.open(request, timeout=12) as response:
    body = response.read()
    status = response.status
    ctype = response.headers.get("content-type") or "text/html; charset=utf-8"
    mitigated = response.headers.get("cf-mitigated") or ""
sys.stdout.buffer.write(str(status).encode() + b"\\n")
sys.stdout.buffer.write(mitigated.encode() + b"\\n")
sys.stdout.buffer.write(ctype.replace("\\n", " ").encode() + b"\\n")
sys.stdout.buffer.write(str(len(body)).encode() + b"\\n")
sys.stdout.buffer.write(body)
`;

function fetchWeebPage(targetUrl, res) {
  const child = spawn("python3", ["-c", WEEB_FETCH, targetUrl], { stdio: ["ignore", "pipe", "pipe"] });
  const chunks = [];
  const timer = setTimeout(() => child.kill(), 12000);
  child.stdout.on("data", (chunk) => chunks.push(chunk));
  child.on("error", () => {
    clearTimeout(timer);
    sendText(res, 502, "Weeb Central proxy failed");
  });
  child.on("close", () => {
    clearTimeout(timer);
    if (res.writableEnded) return;
    const buffer = Buffer.concat(chunks);
    const first = buffer.indexOf(10);
    const second = first >= 0 ? buffer.indexOf(10, first + 1) : -1;
    const third = second >= 0 ? buffer.indexOf(10, second + 1) : -1;
    const fourth = third >= 0 ? buffer.indexOf(10, third + 1) : -1;
    if (fourth < 0) {
      sendText(res, 502, "Weeb Central proxy failed");
      return;
    }
    const status = Number(buffer.slice(0, first).toString());
    const mitigated = buffer.slice(first + 1, second).toString();
    const ctype = buffer.slice(second + 1, third).toString() || "text/html; charset=utf-8";
    const length = Number(buffer.slice(third + 1, fourth).toString());
    const body = buffer.slice(fourth + 1, fourth + 1 + length);
    const preview = body.slice(0, 600).toString("utf8");
    if (!Number.isFinite(status) || status !== 200 || mitigated || body.length !== length || preview.includes("Just a moment")) {
      sendText(res, 502, "Weeb Central did not return a page");
      return;
    }
    res.writeHead(status, {
      "Content-Type": ctype,
      "Cache-Control": status === 200 ? "public, max-age=300" : "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(body);
  });
}

function pipeGet(targetUrl, res, redirectsLeft, accept, sniff) {
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    sendText(res, 400, "Weeb Central address was rejected");
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
      const stayingOnSite = parsed.hostname === HOST && next.startsWith(`https://${HOST}/`);
      const stayingOnImage = sniff && Boolean(weebImageTarget(next)) && new URL(next).hostname === parsed.hostname;
      if (!stayingOnSite && !stayingOnImage) {
        sendText(res, 502, "Upstream redirect was rejected");
        return;
      }
      pipeGet(next, res, redirectsLeft - 1, accept, sniff);
      return;
    }
    if (!sniff) {
      const statusCode = upstream.statusCode || 502;
      const headers = {
        "Content-Type": upstream.headers["content-type"] || "text/html; charset=utf-8",
        "Cache-Control": statusCode === 200 ? (upstream.headers["cache-control"] || "public, max-age=300") : "no-store",
        "X-Content-Type-Options": "nosniff",
      };
      if (upstream.headers["content-length"]) headers["Content-Length"] = upstream.headers["content-length"];
      res.writeHead(upstream.statusCode || 502, headers);
      upstream.pipe(res);
      return;
    }
    const chunks = [];
    let headerSent = false;
    let buffered = Buffer.alloc(0);
    const sendHead = () => {
      if (headerSent || res.writableEnded) return;
      headerSent = true;
      res.writeHead(upstream.statusCode || 502, {
        "Content-Type": sniffType(buffered, upstream.headers["content-type"]),
        "Cache-Control": upstream.headers["cache-control"] || "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      });
      chunks.splice(0).forEach((chunk) => res.write(chunk));
    };
    upstream.on("data", (chunk) => {
      if (headerSent) {
        res.write(chunk);
        return;
      }
      chunks.push(chunk);
      buffered = Buffer.concat(chunks);
      if (buffered.length >= 16) sendHead();
    });
    upstream.on("end", () => {
      sendHead();
      res.end();
    });
    upstream.on("error", () => {
      if (!headerSent) sendText(res, 502, "Weeb Central proxy failed");
      else res.end();
    });
  });
  request.on("timeout", () => request.destroy());
  request.on("error", () => sendText(res, 502, "Weeb Central proxy failed"));
  request.end();
}

function handleWeebProxy(req, res) {
  const method = String(req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    sendText(res, 405, "Method not allowed");
    return;
  }
  let pathname = "/";
  let search = "";
  let requestUrl;
  try {
    requestUrl = new URL(req.url || "/", "http://localhost");
    pathname = requestUrl.pathname;
    search = requestUrl.search || "";
  } catch {
    sendText(res, 400, "Bad request");
    return;
  }
  if (isWeebImagePath(pathname)) {
    const target = weebImageTarget(requestUrl.searchParams.get("url"));
    if (!target) {
      sendText(res, 400, "Image host was rejected");
      return;
    }
    if (method === "HEAD") {
      sendText(res, 200, "");
      return;
    }
    pipeGet(target.toString(), res, 2, "image/avif,image/webp,image/*,*/*", true);
    return;
  }
  const upstream = weebUpstream(pathname, search);
  if (!upstream) {
    sendText(res, 404, "Not Found");
    return;
  }
  if (method === "HEAD") {
    sendText(res, 200, "");
    return;
  }
  fetchWeebPage(upstream, res);
}

module.exports = {
  API_PREFIX,
  IMAGE_PATH,
  handleWeebProxy,
  isWeebApiPath,
  isWeebImagePath,
  weebImageTarget,
  weebUpstream,
};
