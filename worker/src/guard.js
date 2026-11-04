// Fail closed. A public previewer must not fetch loopback, link-local,
// or private addresses, including ones hidden behind DNS.

const BLOCKED_SUFFIXES = [
  ".home.arpa",
  ".internal",
  ".invalid",
  ".lan",
  ".local",
  ".localdomain",
  ".localhost",
  ".onion",
  ".test",
];

/**
 * @param {string} input
 * @returns {{ url: URL } | { error: string }}
 */
export function normaliseUrl(input) {
  let raw = String(input ?? "").trim();
  if (!raw) return { error: "A URL was not provided." };
  if (raw.length > 2048) return { error: "That URL is too long." };
  if (raw.startsWith("//")) raw = `https:${raw}`;
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) raw = `https://${raw}`;

  let url;
  try {
    url = new URL(raw);
  } catch {
    return { error: "That URL is not valid." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { error: "Only http and https URLs can be previewed." };
  }
  if (url.username || url.password) {
    return { error: "URLs with a username or password are not allowed." };
  }
  if (url.port === "0") return { error: "That host cannot be fetched." };

  url.hash = "";
  const host = hostnameOf(url.hostname);
  if (!host || isBlockedHostname(host) || isPrivateAddress(host)) {
    return { error: "That host cannot be fetched." };
  }
  return { url };
}

/**
 * @param {string} hostname
 */
export function isBlockedHostname(hostname) {
  const host = hostnameOf(hostname);
  if (!host) return true;
  if (classifyAddress(host) !== "name") return false;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix) || host === suffix.slice(1))) {
    return true;
  }
  return !host.includes(".");
}

/**
 * @param {string} hostname
 */
export function isPrivateAddress(hostname) {
  return classifyAddress(hostnameOf(hostname)) === "private";
}

/**
 * @param {string} hostname
 */
export function isIpLiteral(hostname) {
  return classifyAddress(hostnameOf(hostname)) !== "name";
}

/**
 * Resolve A and AAAA answers and reject any private address.
 * IP literals are classified locally and do not cause a DNS lookup.
 *
 * @param {string} hostname
 * @param {typeof fetch} doFetch
 */
export async function hostIsPublic(hostname, doFetch) {
  const host = hostnameOf(hostname);
  const kind = classifyAddress(host);
  if (isBlockedHostname(host) || kind === "private") return false;
  if (kind === "public") return true;

  let found = 0;
  for (const type of ["A", "AAAA"]) {
    const endpoint = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`;
    let response;
    try {
      response = await doFetch(endpoint, {
        headers: { accept: "application/dns-json" },
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      return false;
    }
    if (!response.ok) return false;

    let data;
    try {
      data = await response.json();
    } catch {
      return false;
    }

    // 0 NOERROR, 3 NXDOMAIN. Anything else is fail-closed.
    if (data.Status !== 0 && data.Status !== 3) return false;

    for (const answer of data.Answer ?? []) {
      if (answer.type === 5) {
        const target = String(answer.data ?? "").replace(/\.$/, "");
        if (isBlockedHostname(target) || isPrivateAddress(target)) return false;
        continue;
      }
      if (answer.type !== 1 && answer.type !== 28) continue;
      found += 1;
      if (isPrivateAddress(String(answer.data ?? ""))) return false;
    }
  }
  return found > 0;
}

/**
 * @param {string} hostname
 */
function hostnameOf(hostname) {
  return String(hostname ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.+$/, "");
}

/**
 * @param {string} host
 * @returns {"name" | "public" | "private"}
 */
function classifyAddress(host) {
  if (!host) return "private";
  const ipv4 = classifyIpv4(host);
  if (ipv4) return ipv4;
  if (host.includes(":")) return classifyIpv6(host);
  if (/^\d+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) return "private";
  return "name";
}

/**
 * @param {string} host
 * @returns {"public" | "private" | null}
 */
function classifyIpv4(host) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return null;
  const parts = [];
  for (const part of match.slice(1)) {
    if (part.length > 1 && part.startsWith("0")) return "private";
    const value = Number(part);
    if (value > 255) return "private";
    parts.push(value);
  }
  return ipv4Private(parts) ? "private" : "public";
}

/**
 * @param {number[]} parts
 */
function ipv4Private(parts) {
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && parts[2] === 0) return true;
  if (a === 192 && b === 0 && parts[2] === 2) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  if (a >= 224) return true;
  return false;
}

/**
 * @param {string} host
 * @returns {"public" | "private"}
 */
function classifyIpv6(host) {
  if (host.includes("%")) return "private";

  const dotted = /^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(host);
  if (dotted) {
    const v4 = classifyIpv4(dotted[2]);
    if (v4 !== "public") return "private";
    const prefix = dotted[1].toLowerCase();
    if (prefix === "::ffff:" || prefix === "0:0:0:0:0:ffff:" || prefix === "64:ff9b::" || prefix === "64:ff9b:1::") {
      return v4;
    }
  }

  const groups = expandIpv6(host);
  if (!groups) return "private";

  const mapped = ipv4FromMapped(groups);
  if (mapped) return ipv4Private(mapped) ? "private" : "public";

  const nat64 = ipv4FromNat64(groups);
  if (nat64) return ipv4Private(nat64) ? "private" : "public";

  const sixToFour = ipv4From6to4(groups);
  if (sixToFour) return ipv4Private(sixToFour) ? "private" : "public";

  if (groups.every((part) => part === 0)) return "private";
  if (groups[0] === 0 && groups[1] === 0 && groups[2] === 0 && groups[3] === 0 && groups[4] === 0 && groups[5] === 0 && groups[6] === 0 && groups[7] === 1) {
    return "private";
  }
  if ((groups[0] & 0xfe00) === 0xfc00) return "private";
  if ((groups[0] & 0xffc0) === 0xfe80) return "private";
  if ((groups[0] & 0xff00) === 0xff00) return "private";
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return "private";
  return "public";
}

/**
 * @param {number[]} groups
 * @returns {number[] | null}
 */
function ipv4FromMapped(groups) {
  const prefix = groups.slice(0, 5).every((part) => part === 0) && groups[5] === 0xffff;
  if (!prefix) return null;
  return splitPair(groups[6], groups[7]);
}

/**
 * @param {number[]} groups
 * @returns {number[] | null}
 */
function ipv4FromNat64(groups) {
  const wellKnown = groups[0] === 0x0064 && groups[1] === 0xff9b && groups.slice(2, 6).every((part) => part === 0);
  const local = groups[0] === 0x0064 && groups[1] === 0xff9b && groups[2] === 1 && groups.slice(3, 6).every((part) => part === 0);
  if (!wellKnown && !local) return null;
  return splitPair(groups[6], groups[7]);
}

/**
 * @param {number[]} groups
 * @returns {number[] | null}
 */
function ipv4From6to4(groups) {
  if (groups[0] !== 0x2002) return null;
  return splitPair(groups[1], groups[2]);
}

/**
 * @param {number} high
 * @param {number} low
 */
function splitPair(high, low) {
  return [(high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff];
}

/**
 * @param {string} host
 * @returns {number[] | null}
 */
function expandIpv6(host) {
  const halves = host.split("::");
  if (halves.length > 2) return null;
  const parseSide = (side) => (side === "" ? [] : side.split(":"));
  const left = parseSide(halves[0]);
  const right = halves.length === 2 ? parseSide(halves[1]) : [];
  if (left.some((part) => part.includes(".")) || right.some((part) => part.includes("."))) return null;

  let groups;
  if (halves.length === 2) {
    const missing = 8 - left.length - right.length;
    if (missing < 1) return null;
    groups = [...left, ...Array(missing).fill("0"), ...right];
  } else {
    groups = left;
  }
  if (groups.length !== 8) return null;

  const numbers = [];
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(group)) return null;
    numbers.push(Number.parseInt(group, 16));
  }
  return numbers;
}
