import { handlePreview } from "./preview.js";

export { handlePreview };

export default {
  /**
   * `/api/preview` is the fetcher. The MkDocs site calls it from the browser.
   * An optional assets binding can still serve files when one is configured.
   *
   * @param {Request} request
   * @param {{ ASSETS?: { fetch: typeof fetch } }} [env]
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/preview") return handlePreview(request);
    if (env?.ASSETS) {
      const asset = await env.ASSETS.fetch(request);
      if (asset.ok) return asset;
      const missing = await env.ASSETS.fetch(new Request(new URL("/404.html", url)));
      return new Response(missing.body, {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    return new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};
