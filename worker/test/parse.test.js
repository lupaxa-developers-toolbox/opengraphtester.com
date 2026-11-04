import assert from "node:assert/strict";
import test from "node:test";

import { decodeEntities, parseDocument } from "../src/parse.js";

const PAGE = `<!doctype html>
<html>
<head>
  <title>Hello &amp; Welcome</title>
  <meta name="description" content="A sample page">
  <meta property="og:type" content="article">
  <meta property="og:title" content="OG Title">
  <meta property="og:description" content="OG description">
  <meta property="og:image" content="/cover.jpg">
  <meta property="og:image:width" content="1200">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="&quot;Tw Title&quot;">
  <meta property="twitter:site" content="@tester">
  <!-- <meta property="og:title" content="commented"> -->
  <script>var html = '<meta property="og:title" content="scripted">';</script>
</head>
<body>
  <meta property="og:title" content="IGNORE">
</body>
</html>`;

test("decodes the entities used in meta content", () => {
  assert.equal(decodeEntities("Hello &amp; &quot;there&quot;"), "Hello & \"there\"");
  assert.equal(decodeEntities("&#65;&#x42;"), "AB");
  assert.equal(decodeEntities("&amp;quot;"), "&quot;");
});

test("reads head tags and inherits the gaps", () => {
  const graph = parseDocument(PAGE, "https://www.example.com/post");
  assert.ok(graph);

  assert.equal(graph.meta.title.value, "Hello & Welcome");
  assert.equal(graph.meta.title.found, true);
  assert.equal(graph.meta.description.value, "A sample page");

  assert.equal(graph.og.title.value, "OG Title");
  assert.equal(graph.og.title.found, true);
  assert.equal(graph.og.type.value, "article");
  assert.equal(graph.og.image.value, "/cover.jpg");
  assert.equal(graph.og["image:width"].value, "1200");
  assert.equal(graph.og.url.found, false);
  assert.equal(graph.og.url.value, "https://www.example.com/post");

  assert.equal(graph.twitter.card.value, "summary");
  assert.equal(graph.twitter.title.value, "\"Tw Title\"");
  assert.equal(graph.twitter.description.found, false);
  assert.equal(graph.twitter.description.value, "OG description");
  assert.equal(graph.twitter.image.found, false);
  assert.equal(graph.twitter.image.value, "/cover.jpg");
  assert.equal(graph.twitter.site.property, "property");
  assert.equal(graph.twitter.site.value, "@tester");
  assert.equal(graph.twitter.domain.value, "example.com");
  assert.equal(graph.og.title.value === "IGNORE", false);
});

test("falls back to the document title when Open Graph title is missing", () => {
  const graph = parseDocument("<title>Plain</title><meta charset=\"utf-8\">", "https://example.com/");
  assert.ok(graph);
  assert.equal(graph.og.title.found, false);
  assert.equal(graph.og.title.value, "Plain");
  assert.equal(graph.twitter.title.value, "Plain");
  assert.equal(graph.og.type.value, "website");
  assert.equal(graph.twitter.card.value, "summary_large_image");
});

test("returns null when the head has neither a title nor a meta tag", () => {
  assert.equal(parseDocument("<p>No head tags</p>", "https://example.com/"), null);
});

test("a large head still yields the tag near the start", () => {
  const padding = `<meta name="padding" content="${"x".repeat(80)}">`.repeat(400);
  const html = `<head><meta property="og:title" content="Early">${padding}</head>`;
  const graph = parseDocument(html, "https://example.com/");
  assert.equal(graph?.og.title.value, "Early");
});
