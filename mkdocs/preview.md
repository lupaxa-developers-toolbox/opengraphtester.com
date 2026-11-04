# Preview

Paste a public page address. The tester reads the page and shows how the
link will look when it is shared.

<form id="preview-form" class="og-preview" data-worker-origin="https://opengraphtester.thelupaxaproject.workers.dev">
  <div class="og-entry">
    <input id="url" name="url" type="text" inputmode="url" spellcheck="false" autocomplete="url" placeholder="https://example.com" aria-label="Page URL">
    <button class="md-button md-button--primary" type="submit" id="preview">Preview</button>
  </div>
</form>

<p id="status" role="status"></p>

<section id="results" hidden>
  <h2>Previews</h2>
  <div class="og-cards">
    <article class="og-card" data-card="facebook">
      <h3>Facebook</h3>
      <div class="og-frame">
        <div class="shot is-empty"><img alt="" hidden><p class="fallback">No image</p></div>
        <div class="copy">
          <p class="domain"></p>
          <p class="title"></p>
          <p class="description"></p>
        </div>
      </div>
    </article>
    <article class="og-card" data-card="twitter">
      <h3>Twitter</h3>
      <div class="og-frame">
        <div class="shot is-empty"><img alt="" hidden><p class="fallback">No image</p></div>
        <div class="copy">
          <p class="title"></p>
          <p class="description"></p>
          <p class="domain"></p>
        </div>
      </div>
    </article>
    <article class="og-card" data-card="linkedin">
      <h3>LinkedIn</h3>
      <div class="og-frame">
        <div class="shot is-empty"><img alt="" hidden><p class="fallback">No image</p></div>
        <div class="copy">
          <p class="title"></p>
          <p class="domain"></p>
          <p class="description"></p>
        </div>
      </div>
    </article>
    <article class="og-card" data-card="discord">
      <h3>Discord</h3>
      <div class="og-frame">
        <div class="copy">
          <p class="domain"></p>
          <p class="title"></p>
          <p class="description"></p>
        </div>
        <div class="shot is-empty"><img alt="" hidden><p class="fallback">No image</p></div>
      </div>
    </article>
    <article class="og-card" data-card="slack">
      <h3>Slack</h3>
      <div class="og-frame">
        <div class="slack-row">
          <div class="copy">
            <p class="title"></p>
            <p class="description"></p>
            <p class="domain"></p>
          </div>
          <div class="shot is-empty"><img alt="" hidden><p class="fallback">No image</p></div>
        </div>
      </div>
    </article>
    <article class="og-card" data-card="whatsapp">
      <h3>WhatsApp</h3>
      <div class="og-frame">
        <div class="shot is-empty"><img alt="" hidden><p class="fallback">No image</p></div>
        <div class="copy">
          <p class="title"></p>
          <p class="description"></p>
          <p class="domain"></p>
        </div>
      </div>
    </article>
    <article class="og-card" data-card="imessage">
      <h3>iMessage</h3>
      <div class="og-frame">
        <div class="shot is-empty"><img alt="" hidden><p class="fallback">No image</p></div>
        <div class="copy">
          <p class="title"></p>
          <p class="domain"></p>
          <p class="description"></p>
        </div>
      </div>
    </article>
    <article class="og-card" data-card="telegram">
      <h3>Telegram</h3>
      <div class="og-frame">
        <div class="copy">
          <p class="domain"></p>
          <p class="title"></p>
          <p class="description"></p>
        </div>
        <div class="shot is-empty"><img alt="" hidden><p class="fallback">No image</p></div>
      </div>
    </article>
    <article class="og-card" data-card="signal">
      <h3>Signal</h3>
      <div class="og-frame">
        <div class="shot is-empty"><img alt="" hidden><p class="fallback">No image</p></div>
        <div class="copy">
          <p class="title"></p>
          <p class="description"></p>
          <p class="domain"></p>
        </div>
      </div>
    </article>
    <article class="og-card" data-card="teams">
      <h3>Teams</h3>
      <div class="og-frame">
        <div class="shot is-empty"><img alt="" hidden><p class="fallback">No image</p></div>
        <div class="copy">
          <p class="title"></p>
          <p class="description"></p>
          <p class="domain"></p>
        </div>
      </div>
    </article>
  </div>

  <h2>Tag Details</h2>
  <div class="og-tags">
    <section>
      <div class="og-tag-bar">
        <h3>Collected Tags</h3>
        <button type="button" data-copy="collected">Copy</button>
      </div>
      <pre><code id="collected"></code></pre>
    </section>
    <section>
      <div class="og-tag-bar">
        <h3>Processed Tags</h3>
        <button type="button" data-copy="processed">Copy</button>
      </div>
      <pre><code id="processed"></code></pre>
    </section>
  </div>
</section>
