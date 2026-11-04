import { hostIsPublic, normaliseUrl } from "./guard.js";
import { parseDocument } from "./parse.js";

const USER_AGENT = "OpenGraphTester (+https://github.com/lupaxa-developers-toolbox/opengraphtester.com)";
const PAGE_BYTES = 131072;
const MAX_REDIRECTS = 5;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "Content-Type",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

/**
 * @param {Request} request
 * @param {{ fetch?: typeof fetch }} [deps]
 */
export async function handlePreview(request, deps = {}) {
  if (request.method === "OPTIONS") return json(null, 204);
  if (request.method !== "GET") return json({ ok: false, error: "Use GET." }, 405);

  const target = new URL(request.url).searchParams.get("url");
  if (target === null || target.trim() === "") {
    return json({ ok: false, error: "A URL was not provided." }, 400);
  }

  const parsed = normaliseUrl(target);
  if ("error" in parsed) return json({ ok: false, error: parsed.error }, 400);

  const page = await fetchHtml(parsed.url, deps.fetch ?? fetch);
  if ("error" in page) return json({ ok: false, error: page.error }, page.status);

  const graph = parseDocument(page.html, page.finalUrl);
  if (!graph) return json({ ok: false, error: "No open graph tags found." }, 422);

  return json({ ok: true, finalUrl: page.finalUrl, ...graph }, 200);
}

/**
 * @param {URL} initialUrl
 * @param {typeof fetch} doFetch
 * @returns {Promise<{ html: string, finalUrl: string } | { error: string, status: number }>}
 */
async function fetchHtml(initialUrl, doFetch) {
  let current = initialUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let allowed = false;
    try {
      allowed = await hostIsPublic(current.hostname, doFetch);
    } catch {
      return { error: "Unable to retrieve page.", status: 502 };
    }
    if (!allowed) return { error: "That host cannot be fetched.", status: 400 };

    let response;
    try {
      response = await doFetch(current.href, {
        method: "GET",
        redirect: "manual",
        headers: {
          accept: "text/html,application/xhtml+xml;q=0.9",
          "user-agent": USER_AGENT,
        },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      return { error: "Unable to retrieve page.", status: 502 };
    }

    if (isRedirect(response.status)) {
      const location = response.headers.get("location");
      await cancel(response);
      if (!location || hop === MAX_REDIRECTS) {
        return { error: "Unable to retrieve page.", status: 502 };
      }
      let next;
      try {
        next = new URL(location, current);
      } catch {
        return { error: "Unable to retrieve page.", status: 502 };
      }
      const redirected = normaliseUrl(next.href);
      if ("error" in redirected) return { error: redirected.error, status: 400 };
      current = redirected.url;
      continue;
    }

    if (response.status === 404) {
      await cancel(response);
      return { error: "Page not found.", status: 404 };
    }
    if (response.status === 403 || response.status !== 200) {
      await cancel(response);
      return { error: "Unable to retrieve page.", status: 502 };
    }

    const contentType = response.headers.get("content-type") || "";
    if (!readableType(contentType)) {
      await cancel(response);
      return { error: "Unable to retrieve page.", status: 422 };
    }

    const html = await readHead(response);
    if (!html.includes("<")) return { error: "No open graph tags found.", status: 422 };
    return { html, finalUrl: current.href };
  }

  return { error: "Unable to retrieve page.", status: 502 };
}

/**
 * @param {number} status
 */
function isRedirect(status) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

/**
 * @param {string} contentType
 */
function readableType(contentType) {
  if (!contentType.trim()) return true;
  const type = contentType.split(";", 1)[0].trim().toLowerCase();
  return type === "text/html"
    || type === "application/xhtml+xml"
    || type === "text/plain"
    || type === "application/octet-stream";
}

/**
 * Stop at the end of the head, or at 128 KiB, so the rest of the body is never parsed.
 *
 * @param {Response} response
 */
async function readHead(response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  /** @type {Uint8Array[]} */
  const chunks = [];
  let total = 0;
  let carry = new Uint8Array(0);
  let emptyReads = 0;

  try {
    while (total < PAGE_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) {
        emptyReads += 1;
        if (emptyReads > 8) break;
        continue;
      }
      const room = PAGE_BYTES - total;
      const slice = value.byteLength > room ? value.subarray(0, room) : value;
      chunks.push(slice);
      total += slice.byteLength;
      if (boundaryHasHead(carry, slice)) break;
      carry = tailBytes(carry, slice, 6);
    }
  } finally {
    await cancel({ body: { cancel: () => reader.cancel() } });
  }

  const bytes = concat(chunks);
  const end = findHeadEnd(bytes);
  const head = end === -1 ? bytes : bytes.subarray(0, end);
  return new TextDecoder(sniffEncoding(head), { fatal: false }).decode(head);
}

/**
 * @param {Uint8Array} carry
 * @param {Uint8Array} chunk
 */
function boundaryHasHead(carry, chunk) {
  if (carry.length === 0) return findHeadEnd(chunk) !== -1;
  const combo = new Uint8Array(carry.length + chunk.length);
  combo.set(carry, 0);
  combo.set(chunk, carry.length);
  return findHeadEnd(combo) !== -1;
}

/**
 * @param {Uint8Array} carry
 * @param {Uint8Array} chunk
 * @param {number} size
 */
function tailBytes(carry, chunk, size) {
  if (chunk.length >= size) return chunk.subarray(chunk.length - size);
  const out = new Uint8Array(Math.min(size, carry.length + chunk.length));
  const fromCarry = out.length - chunk.length;
  if (fromCarry > 0) out.set(carry.subarray(carry.length - fromCarry), 0);
  out.set(chunk, fromCarry);
  return out;
}

/**
 * @param {Uint8Array[]} chunks
 */
function concat(chunks) {
  let size = 0;
  for (const chunk of chunks) size += chunk.byteLength;
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * Case-insensitive search for the bytes `</head>`.
 *
 * @param {Uint8Array} bytes
 */
function findHeadEnd(bytes) {
  const target = [60, 47, 104, 101, 97, 100, 62];
  for (let index = 0; index <= bytes.length - target.length; index += 1) {
    if (bytes[index] !== 60 || bytes[index + 1] !== 47) continue;
    let matched = true;
    for (let offset = 2; offset < 6; offset += 1) {
      let code = bytes[index + offset];
      if (code >= 65 && code <= 90) code += 32;
      if (code !== target[offset]) {
        matched = false;
        break;
      }
    }
    if (matched && bytes[index + 6] === 62) return index;
  }
  return -1;
}

/**
 * @param {Uint8Array} bytes
 */
function sniffEncoding(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return "utf-8";
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return "utf-16le";
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return "utf-16be";

  const sniff = new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(bytes.length, 2048)));
  const match = /charset\s*=\s*["']?\s*([a-z0-9._-]+)/i.exec(sniff);
  if (!match) return "utf-8";
  return decoderLabel(match[1].toLowerCase());
}

/**
 * @param {string} label
 */
function decoderLabel(label) {
  if (label === "utf8" || label === "utf-8" || label === "us-ascii") return "utf-8";
  if (label === "latin1" || label === "iso-8859-1" || label === "windows-1252") return "windows-1252";
  try {
    new TextDecoder(label);
    return label;
  } catch {
    return "utf-8";
  }
}

/**
 * @param {{ body?: { cancel?: () => Promise<void> | void } | null }} response
 */
async function cancel(response) {
  try {
    await response.body?.cancel?.();
  } catch {
    // The body may already be consumed or closed.
  }
}

/**
 * @param {unknown} body
 * @param {number} status
 */
function json(body, status) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      "content-type": "application/json; charset=utf-8",
    },
  });
}
