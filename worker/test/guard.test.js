import assert from "node:assert/strict";
import test from "node:test";

import { hostIsPublic, isPrivateAddress, normaliseUrl } from "../src/guard.js";

test("normalises a bare host and rejects hosts that must not be fetched", () => {
  const bare = normaliseUrl("Example.com/path");
  assert.equal("url" in bare && bare.url.href, "https://example.com/path");

  const explicitHttp = normaliseUrl("http://example.com/plain");
  assert.equal("url" in explicitHttp && explicitHttp.url.href, "http://example.com/plain");

  const relative = normaliseUrl("//cdn.example/a");
  assert.equal("url" in relative && relative.url.href, "https://cdn.example/a");

  for (const input of [
    "",
    "   ",
    "ftp://example.com",
    "file:///etc/passwd",
    "http://user:pass@example.com",
    "http://127.0.0.1/",
    "http://127.000.000.001/",
    "http://2130706433/",
    "http://0x7f000001/",
    "http://10.1.2.3/",
    "http://192.168.1.9/",
    "http://172.16.0.4/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://[fe80::1]/",
    "http://[fd00::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[2002:7f00:1::]/",
    "http://localhost/admin",
    "http://printer.local/",
    "http://metadata.google.internal/",
    "http://secret.internal/latest",
    "http://singlelabel/",
    "not a url",
    `http://${"a".repeat(2050)}.example`,
  ]) {
    const result = normaliseUrl(input);
    assert.equal("error" in result, true, input);
  }
});

test("allows ordinary public addresses", () => {
  assert.equal(isPrivateAddress("8.8.8.8"), false);
  assert.equal(isPrivateAddress("1.1.1.1"), false);
  assert.equal(isPrivateAddress("172.15.0.1"), false);
  assert.equal(isPrivateAddress("2001:4860:4860::8888"), false);
  assert.equal("url" in normaliseUrl("https://www.example.com/a?b=1#frag"), true);
  const url = normaliseUrl("https://www.example.com/a?b=1#frag");
  assert.equal("url" in url && url.url.hash, "");
});

test("DNS answers that include a private address are rejected", async () => {
  const calls = [];
  const result = await hostIsPublic("rebind.example", async (input) => {
    calls.push(String(input));
    return Response.json({
      Status: 0,
      Answer: [{ name: "rebind.example", type: 1, data: "10.0.0.4" }],
    });
  });
  assert.equal(result, false);
  assert.equal(calls.length, 1);
});

test("a public DNS answer is accepted after both record types", async () => {
  const types = [];
  const result = await hostIsPublic("example.com", async (input) => {
    const type = new URL(String(input)).searchParams.get("type");
    types.push(type);
    const data = type === "AAAA" ? "2606:2800:220:1:248:1893:25c8:1946" : "93.184.216.34";
    const recordType = type === "AAAA" ? 28 : 1;
    return Response.json({
      Status: 0,
      Answer: [{ name: "example.com", type: recordType, data }],
    });
  });
  assert.equal(result, true);
  assert.deepEqual(types, ["A", "AAAA"]);
});

test("a CNAME to localhost is rejected", async () => {
  const result = await hostIsPublic("loop.example", async () => Response.json({
    Status: 0,
    Answer: [{ name: "loop.example", type: 5, data: "localhost." }],
  }));
  assert.equal(result, false);
});
