const REPO = "MY-moss/moyang_Reader";
const RELEASE_BASE = "https://github.com/" + REPO + "/releases/download";
const LATEST_MANIFEST = "https://github.com/" + REPO + "/releases/latest/download/latest.json";
const USER_AGENT = "moyang-reader-mirror";

function jsonResponse(value, status, cacheControl) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheControl,
      "access-control-allow-origin": "*",
    },
  });
}

async function latestManifest(request) {
  const response = await fetch(LATEST_MANIFEST, {
    redirect: "follow",
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
  });
  if (!response.ok) {
    return jsonResponse({ error: "upstream release metadata unavailable", status: response.status }, 502, "no-store");
  }

  const manifest = await response.json();
  for (const [platformName, platform] of Object.entries(manifest.platforms || {})) {
    if (platformName.startsWith("windows-")) {
      const assetName = "Moyang.Reader_" + manifest.version + "_x64-setup.exe";
      platform.url = new URL("/v" + manifest.version + "/" + assetName, request.url).toString();
    }
  }

  return jsonResponse(manifest, 200, "public, max-age=60, s-maxage=60");
}

async function assetProxy(url) {
  const match = url.pathname.match(/^\/v(\d+\.\d+\.\d+)\/([A-Za-z0-9._-]+)$/);
  if (!match) return new Response("not found", { status: 404 });

  const upstream = RELEASE_BASE + "/v" + match[1] + "/" + match[2];
  const response = await fetch(upstream, {
    redirect: "follow",
    headers: { "user-agent": USER_AGENT },
  });
  const headers = new Headers(response.headers);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("access-control-allow-origin", "*");
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/latest.json") return await latestManifest(request);
      if (url.pathname === "/" || url.pathname === "") {
        return new Response("Moyang Reader update mirror", {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=300",
          },
        });
      }
      return await assetProxy(url);
    } catch {
      return jsonResponse({ error: "mirror proxy failure" }, 502, "no-store");
    }
  },
};
