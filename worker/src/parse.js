// Read Open Graph and Twitter Card tags from the document head.
// The caller passes only the head, capped, so this stays cheap on a 10 ms CPU limit.

const META_LIMIT = 300;
const VALUE_LIMIT = 2000;

/**
 * @param {string} html
 * @param {string} finalUrl
 * @returns {{ meta: Record<string, Tag>, og: Record<string, Tag>, twitter: Record<string, Tag> } | null}
 */
export function parseDocument(html, finalUrl) {
  const raw = String(html ?? "");
  const headEnd = raw.toLowerCase().indexOf("</head>");
  const source = stripNonContent(headEnd === -1 ? raw : raw.slice(0, headEnd));
  const tags = collectMeta(source);
  const title = readTitle(source);
  if (tags.length === 0 && !title.found) return null;

  const meta = {
    title: { value: title.value, found: title.found },
    description: { value: "", found: false },
  };
  const og = {
    type: tag("property", "website", false),
    title: tag("property", "", false),
    description: tag("property", "", false),
    image: tag("property", "", false),
    url: tag("property", "", false),
  };
  const twitter = {
    card: tag("name", "summary_large_image", false),
    title: tag("name", "", false),
    description: tag("name", "", false),
    image: tag("name", "", false),
    url: tag("property", "", false),
    domain: tag("property", "", false),
  };

  let description = "";
  for (const attrs of tags) {
    const property = (attrs.property ?? "").trim().toLowerCase();
    const name = (attrs.name ?? "").trim().toLowerCase();
    const content = attrs.content ?? "";

    if (property.startsWith("og:")) {
      const key = metaKey(property.slice(3));
      if (key) og[key] = tag("property", content, true);
    }
    if (name.startsWith("twitter:")) {
      const key = metaKey(name.slice(8));
      if (key) twitter[key] = tag("name", content, true);
    }
    if (property.startsWith("twitter:")) {
      const key = metaKey(property.slice(8));
      if (key) twitter[key] = tag("property", content, true);
    }
    if (name === "description" && content) description = content;
  }

  if (!meta.description.found && description) {
    meta.description = { value: description, found: true };
  }

  if (!og.title.found) og.title = { ...og.title, value: meta.title.value.trim() };
  if (!og.description.found) og.description = { ...og.description, value: meta.description.value.trim() };
  if (!twitter.title.found) twitter.title = { ...twitter.title, value: og.title.value.trim() };
  if (!twitter.description.found) twitter.description = { ...twitter.description, value: og.description.value.trim() };
  if (!twitter.image.found) twitter.image = { ...twitter.image, value: og.image.value.trim() };

  if (!og.url.found) og.url = { ...og.url, value: finalUrl };
  if (!twitter.url.found) twitter.url = { ...twitter.url, value: finalUrl };
  if (!twitter.domain.found) {
    twitter.domain = { ...twitter.domain, value: displayDomain(finalUrl) };
  }

  return { meta, og, twitter };
}

/**
 * @param {string} property
 * @param {string} value
 * @param {boolean} found
 * @returns {Tag}
 */
function tag(property, value, found) {
  return { property, value, found };
}

/**
 * @param {string} html
 */
function stripNonContent(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "");
}

/**
 * @param {string} html
 * @returns {Array<Record<string, string>>}
 */
function collectMeta(html) {
  const tags = [];
  const pattern = /<meta\b([^>]*)>/gi;
  let match = pattern.exec(html);
  while (match && tags.length < META_LIMIT) {
    tags.push(parseAttributes(match[1]));
    match = pattern.exec(html);
  }
  return tags;
}

/**
 * @param {string} source
 */
function parseAttributes(source) {
  /** @type {Record<string, string>} */
  const attrs = {};
  const pattern = /([^\s=/><]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match = pattern.exec(source);
  while (match) {
    const name = match[1].toLowerCase();
    const raw = match[2] ?? match[3] ?? match[4] ?? "";
    if (!(name in attrs)) attrs[name] = clamp(decodeEntities(raw));
    match = pattern.exec(source);
  }
  return attrs;
}

/**
 * @param {string} html
 */
function readTitle(html) {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!match) return { value: "", found: false };
  const value = clamp(decodeEntities(match[1].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()));
  return { value, found: true };
}

/**
 * @param {string} suffix
 */
function metaKey(suffix) {
  const key = suffix.trim().toLowerCase().replace(/-/g, "_");
  if (!key || !/^[a-z0-9:_]+$/.test(key)) return "";
  return key;
}

/**
 * @param {string} value
 */
function clamp(value) {
  return value.length > VALUE_LIMIT ? value.slice(0, VALUE_LIMIT) : value;
}

/**
 * @param {string} value
 */
export function decodeEntities(value) {
  return value
    .replace(/&#(\d+);/g, (all, digits) => safeChar(Number(digits)) ?? all)
    .replace(/&#x([0-9a-f]+);/gi, (all, hex) => safeChar(Number.parseInt(hex, 16)) ?? all)
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, "\"")
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

/**
 * @param {number} code
 */
function safeChar(code) {
  if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return null;
  if (code === 0 || (code >= 0xd800 && code <= 0xdfff)) return null;
  return String.fromCodePoint(code);
}

/**
 * @param {string} finalUrl
 */
function displayDomain(finalUrl) {
  try {
    return new URL(finalUrl).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

/**
 * @typedef {{ property?: string, value: string, found: boolean }} Tag
 */
