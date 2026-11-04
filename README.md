<p align="center">
  <a href="https://github.com/lupaxa-developers-toolbox">
    <img src="https://raw.githubusercontent.com/the-lupaxa-project/brand-assets/master/logos/organisations/developers-toolbox/readme-logo.png" alt="Developers Toolbox" />
  </a>
</p>

<h1 align="center">Opengraphtester.com</h1>

Preview how a page's Open Graph and Twitter Card tags will look when shared.

The site is MkDocs, published with GitHub Pages. The Preview page calls a
Cloudflare Worker on the free plan (10 ms of CPU), which fetches the URL
and returns the tags. The earlier PHP site in
WolfSoftware/opengraphtester.com is only a behaviour reference.

## Quick Start

Serve the site:

```bash
make mkdocs-serve
```

In another terminal, serve the worker:

```bash
cd worker
npm install
npx wrangler dev
```

Open the Preview page. On localhost it calls `http://127.0.0.1:8787`.
For any other host, set `data-worker-origin` on the preview form to the
worker origin, with no trailing slash.

## What the Worker Does

`GET /api/preview?url=` fetches the page and returns JSON: the final URL
after redirects, the document title and description, and every Open Graph
and Twitter Card tag. Each tag has the attribute it was read from
(`property` or `name`), the value, and whether the page included it.

A host with no scheme is fetched as `https`. The worker follows up to
five redirects, reads at most 128 KiB, and stops at `</head>`. Images
are not copied. The page loads an image URL in the browser when it is
`http` or `https`.

Missing tags are filled in, and `found` stays false for those values.
Open Graph title and description fall back to the document. Twitter
title, description, and image fall back to Open Graph. A missing
`og:url` becomes the final URL. A missing `twitter:domain` is the
hostname without a leading `www`.

The address must be `http` or `https`, with no username or password.
Loopback, link-local, private, and metadata addresses are refused, and
so is a public name whose DNS answer points at one of those. A redirect
onto one of those hosts is refused as well.

Worker tests:

```bash
cd worker
node --test
```

## Deploy

Pushes to `master` that change `mkdocs/` run `.github/workflows/publish-mkdocs.yml`.

The free plan caps each request at 10 ms of CPU. `wrangler.toml` does not set `cpu_ms`, because the free plan rejects that setting.

```bash
cd worker
npx wrangler deploy
```

The worker is at `https://opengraphtester.thelupaxaproject.workers.dev`.
The preview form `data-worker-origin` is that address, with no trailing
slash. Localhost still calls `http://127.0.0.1:8787`.

<a href="https://github.com/the-lupaxa-project">
    <img src="https://raw.githubusercontent.com/the-lupaxa-project/brand-assets/master/logos/components/footer-for-child-orgs.svg" alt="The Lupaxa Project Footer" width="100%" />
</a>
