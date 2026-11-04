import assert from "node:assert/strict";
import test from "node:test";

import worker, { handlePreview } from "../src/index.js";

const HTML = `<!doctype html><html><head>
<title>Example</title>
<meta property="og:title" content="Shared title">
<meta property="og:description" content="Shared text">
<meta property="og:image" content="https://cdn.example/a.png">
</head><body>body <meta property="og:title" content="nope"></body></html>`;

test("returns Open Graph and Twitter Card tags for a public page", async () => {
  const { fetch, calls } = mockFetch({
    "https://example.com/post": html(HTML),
    "https://cloudflare-dns.com/dns-query": dns("93.184.216.34"),
  });

  const response = await handlePreview(new Request("https://worker.test/api/preview?url=https://example.com/post"), { fetch });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.finalUrl, "https://example.com/post");
  assert.equal(body.og.title.value, "Shared title");
  assert.equal(body.og.description.value, "Shared text");
  assert.equal(body.twitter.title.value, "Shared title");
  assert.equal(body.twitter.description.found, false);
  assert.equal(body.twitter.description.value, "Shared text");
  assert.equal(body.twitter.card.value, "summary_large_image");
  assert.equal(calls.some((url) => url.startsWith("https://example.com/post")), true);
});

test("does not fetch a literal private address", async () => {
  const response = await handlePreview(
    new Request("https://worker.test/api/preview?url=http://169.254.169.254/latest/meta-data/"),
    { fetch: () => { throw new Error("fetch should not run"); } },
  );
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error, "That host cannot be fetched.");
});

test("does not fetch when DNS answers with a private address", async () => {
  const { fetch, calls } = mockFetch({
    "https://cloudflare-dns.com/dns-query": dns("192.168.1.20"),
  });
  const response = await handlePreview(new Request("https://worker.test/api/preview?url=http://rebind.example/"), { fetch });
  assert.equal(response.status, 400);
  assert.equal(calls.some((url) => url.startsWith("http://rebind.example")), false);
});

test("refuses a redirect onto a link-local address", async () => {
  const { fetch, calls } = mockFetch({
    "https://cloudflare-dns.com/dns-query": dns("93.184.216.34"),
    "https://example.com/go": new Response(null, {
      status: 302,
      headers: { location: "http://169.254.169.254/latest/" },
    }),
  });
  const response = await handlePreview(new Request("https://worker.test/api/preview?url=https://example.com/go"), { fetch });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error, "That host cannot be fetched.");
  assert.equal(calls.some((url) => url.includes("169.254.169.254")), false);
});

test("follows a redirect to another public page", async () => {
  const { fetch } = mockFetch({
    "https://cloudflare-dns.com/dns-query": dns("93.184.216.34"),
    "https://example.com/old": new Response(null, {
      status: 301,
      headers: { location: "/new" },
    }),
    "https://example.com/new": html("<title>Moved</title><meta charset=\"utf-8\">"),
  });
  const response = await handlePreview(new Request("https://worker.test/api/preview?url=https://example.com/old"), { fetch });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.finalUrl, "https://example.com/new");
  assert.equal(body.meta.title.value, "Moved");
  assert.equal(body.og.title.value, "Moved");
});

test("reports an empty URL and a missing page", async () => {
  const empty = await handlePreview(new Request("https://worker.test/api/preview?url="));
  assert.equal(empty.status, 400);
  assert.equal((await empty.json()).error, "A URL was not provided.");

  const missingParam = await handlePreview(new Request("https://worker.test/api/preview"));
  assert.equal(missingParam.status, 400);

  const { fetch } = mockFetch({
    "https://cloudflare-dns.com/dns-query": dns("93.184.216.34"),
    "https://example.com/missing": new Response("nope", { status: 404, headers: { "content-type": "text/html" } }),
  });
  const missing = await handlePreview(new Request("https://worker.test/api/preview?url=https://example.com/missing"), { fetch });
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error, "Page not found.");
});

test("the worker entry routes the preview and leaves other paths alone", async () => {
  const preview = await worker.fetch(new Request("https://worker.test/api/preview"));
  assert.equal(preview.status, 400);

  const other = await worker.fetch(new Request("https://worker.test/"));
  assert.equal(other.status, 404);

  const asset = await worker.fetch(new Request("https://worker.test/"), {
    ASSETS: {
      fetch: async () => new Response("page", { status: 200, headers: { "content-type": "text/html" } }),
    },
  });
  assert.equal(await asset.text(), "page");

  const missing = await worker.fetch(new Request("https://worker.test/missing"), {
    ASSETS: {
      fetch: async (input) => {
        const path = new URL(typeof input === "string" ? input : input.url).pathname;
        if (path === "/404.html") {
          return new Response("<h1>Page Not Found</h1>", { status: 200, headers: { "content-type": "text/html" } });
        }
        return new Response("no", { status: 404 });
      },
    },
  });
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /Page Not Found/);
});

/**
 * @param {Record<string, Response | (() => Response)>} routes
 */
function mockFetch(routes) {
  const calls = [];
  return {
    calls,
    async fetch(input) {
      const url = String(input);
      calls.push(url);
      const match = Object.keys(routes).find((prefix) => url.startsWith(prefix));
      if (!match) throw new Error(`unexpected fetch ${url}`);
      const route = routes[match];
      // Do not clone. Cloning tees the body, and cancelling one branch
      // waits forever for the unread original.
      return typeof route === "function" ? route() : route;
    },
  };
}

/**
 * @param {string} html
 */
function html(htmlText) {
  return () => new Response(htmlText, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

/**
 * @param {string} address
 */
function dns(address) {
  return () => Response.json({
    Status: 0,
    Answer: [{ name: "example.com", type: address.includes(":") ? 28 : 1, data: address }],
  });
}
