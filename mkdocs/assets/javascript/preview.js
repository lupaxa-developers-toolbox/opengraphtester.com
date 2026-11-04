const form = document.querySelector("#preview-form");

if (form) {
  const urlInput = document.querySelector("#url");
  const previewButton = document.querySelector("#preview");
  const tryExample = document.querySelector("#try-example");
  const status = document.querySelector("#status");
  const results = document.querySelector("#results");
  let currentRequest = null;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void preview(urlInput.value);
  });

  urlInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing || event.repeat) return;
    event.preventDefault();
    void preview(urlInput.value);
  });

  tryExample?.addEventListener("click", () => {
    urlInput.value = "https://example.com";
    void preview(urlInput.value);
  });

  for (const button of document.querySelectorAll("[data-copy]")) {
    button.addEventListener("click", () => copyBlock(button));
  }

  for (const image of document.querySelectorAll(".shot img")) {
    image.addEventListener("error", () => {
      image.hidden = true;
      image.closest(".shot").classList.add("is-empty");
    });
    image.addEventListener("load", () => {
      const card = image.closest(".og-card");
      if (card?.dataset.card === "slack" && image.naturalWidth >= 500) {
        card.classList.add("is-large");
      }
    });
  }

  async function preview(rawUrl) {
    const pageUrl = withDefaultScheme(rawUrl);
    urlInput.value = pageUrl;
    results.hidden = true;
    if (!pageUrl) {
      setStatus("A URL was not provided.", true);
      return;
    }

    const endpoint = previewEndpoint(pageUrl);
    if (!endpoint) {
      setStatus("Set data-worker-origin on the preview form to the worker origin.", true);
      return;
    }

    currentRequest?.abort();
    const controller = new AbortController();
    currentRequest = controller;
    previewButton.disabled = true;
    setStatus("Fetching tags…", false);

    try {
      const response = await fetch(endpoint, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      const body = await response.json();
      if (!body.ok) {
        setStatus(body.error || "Unable to retrieve page.", true);
        return;
      }
      render(body);
      setStatus("", false);
      results.hidden = false;
    } catch (error) {
      if (error.name === "AbortError") return;
      setStatus("The preview service did not respond.", true);
    } finally {
      if (currentRequest === controller) previewButton.disabled = false;
    }
  }

  function withDefaultScheme(value) {
    const raw = value.trim();
    if (!raw) return raw;
    if (raw.startsWith("//")) return `https:${raw}`;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) return `https://${raw}`;
    return raw;
  }

  function previewEndpoint(pageUrl) {
    const configured = String(form.dataset.workerOrigin || "").replace(/\/$/, "");
    let origin = configured;
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
      origin = "http://127.0.0.1:8787";
    }
    if (!origin && location.hostname.endsWith("github.io")) return null;
    if (!origin) origin = location.origin;
    const endpoint = new URL("/api/preview", `${origin}/`);
    endpoint.searchParams.set("url", pageUrl);
    return endpoint;
  }

  function render(body) {
    const base = body.finalUrl;
    const hostname = hostOf(body.og.url.value);
    const namedSite = siteLabel(body.og, hostname);
    fillCard(document.querySelector('[data-card="facebook"]'), base, {
      image: body.og.image,
      domain: hostOf(body.og.url.value),
      title: body.og.title.value,
      description: body.og.description.value,
    });
    fillCard(document.querySelector('[data-card="twitter"]'), base, {
      image: body.twitter.image.found ? body.twitter.image : body.og.image,
      domain: body.twitter.domain.value,
      title: body.twitter.title.value,
      description: body.twitter.description.value,
    });
    fillCard(document.querySelector('[data-card="linkedin"]'), base, {
      image: body.og.image,
      domain: hostOf(body.og.url.value),
      title: body.og.title.value,
      description: "",
    });
    fillCard(document.querySelector('[data-card="discord"]'), base, {
      image: body.og.image,
      domain: hostOf(body.og.url.value),
      title: body.og.title.value,
      description: body.og.description.value,
    });
    fillCard(document.querySelector('[data-card="slack"]'), base, {
      image: body.og.image?.found ? body.og.image : body.twitter.image,
      domain: namedSite,
      title: body.og.title.value,
      description: body.og.description.value,
      large: slackIsLarge(body),
    });
    fillCard(document.querySelector('[data-card="whatsapp"]'), base, {
      image: body.og.image,
      domain: hostname,
      title: body.og.title.value,
      description: body.og.description.value,
    });
    fillCard(document.querySelector('[data-card="imessage"]'), base, {
      image: body.og.image,
      domain: hostname,
      title: body.og.title.value,
      description: "",
    });
    fillCard(document.querySelector('[data-card="telegram"]'), base, {
      image: body.og.image,
      domain: namedSite,
      title: body.og.title.value,
      description: body.og.description.value,
    });
    fillCard(document.querySelector('[data-card="signal"]'), base, {
      image: body.og.image,
      domain: hostname,
      title: body.og.title.value,
      description: body.og.description.value,
    });
    fillCard(document.querySelector('[data-card="teams"]'), base, {
      image: body.og.image,
      domain: hostname,
      title: body.og.title.value,
      description: body.og.description.value,
    });

    document.querySelector("#collected").textContent = formatTags(body, false);
    document.querySelector("#processed").textContent = formatTags(body, true);
  }

  function setStatus(message, isError) {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }
}

function fillCard(card, base, fields) {
  const image = card.querySelector("img");
  const shot = card.querySelector(".shot");
  const safe = safeImage(fields.image, base);
  if (safe) {
    image.hidden = false;
    image.src = safe;
    shot.classList.remove("is-empty");
  } else {
    image.hidden = true;
    image.removeAttribute("src");
    shot.classList.add("is-empty");
  }
  card.querySelector(".domain").textContent = fields.domain || "";
  card.querySelector(".title").textContent = fields.title || "";
  card.querySelector(".description").textContent = fields.description || "";
  if (card.dataset.card === "slack") card.classList.toggle("is-large", Boolean(fields.large));
}

function siteLabel(og, hostname) {
  const named = og.site_name;
  if (named?.found && named.value.trim()) return named.value.trim();
  return hostname;
}

function slackIsLarge(body) {
  const card = body.twitter.card;
  if (card?.found && card.value.trim().toLowerCase() === "summary_large_image") return true;
  const width = Number(body.og["image:width"]?.value);
  return Number.isFinite(width) && width >= 500;
}

function safeImage(image, base) {
  if (!image?.found || !image.value) return "";
  try {
    const url = new URL(image.value, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.href;
  } catch {
    return "";
  }
}

function hostOf(value) {
  try {
    return new URL(value).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function formatTags(body, processed) {
  const lines = ["<!-- Start of HTML Meta Tags -->"];
  if (processed || body.meta.title.found) {
    lines.push(`<title>${escapeText(body.meta.title.value)}</title>`);
  }
  if (processed || body.meta.description.found) {
    lines.push(`<meta name="description" content="${escapeAttr(body.meta.description.value)}">`);
  }
  lines.push("<!-- End of HTML Meta Tags -->", "", "<!-- Start of Facebook Meta Tags -->");
  for (const [key, details] of ordered(body.og, ["type", "title", "description", "image", "url"])) {
    if (processed || details.found) {
      lines.push(`<meta ${details.property}="og:${key}" content="${escapeAttr(details.value)}">`);
    }
  }
  lines.push("<!-- End of Facebook Meta Tags -->", "", "<!-- Start of Twitter Meta Tags -->");
  for (const [key, details] of ordered(body.twitter, ["card", "title", "description", "image", "url", "domain"])) {
    if (processed || details.found) {
      lines.push(`<meta ${details.property}="twitter:${key}" content="${escapeAttr(details.value)}">`);
    }
  }
  lines.push("<!-- End of Twitter Meta Tags -->");
  if (processed) lines.push("", "<!-- Meta Tags Generated via https://opengraphtester.com -->");
  return lines.join("\n");
}

function ordered(tags, first) {
  return Object.keys(tags).sort((left, right) => {
    const leftIndex = first.indexOf(left);
    const rightIndex = first.indexOf(right);
    if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  }).map((key) => [key, tags[key]]);
}

function escapeAttr(value) {
  return escapeText(value).replace(/"/g, "&quot;");
}

function escapeText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function copyBlock(button) {
  const text = document.querySelector(`#${button.dataset.copy}`).textContent;
  const status = document.querySelector("#status");
  try {
    await navigator.clipboard.writeText(text);
    const previous = button.textContent;
    button.textContent = "Copied";
    setTimeout(() => { button.textContent = previous; }, 1600);
  } catch {
    status.textContent = "Copy failed. Select the tags and copy them manually.";
    status.classList.add("is-error");
  }
}
