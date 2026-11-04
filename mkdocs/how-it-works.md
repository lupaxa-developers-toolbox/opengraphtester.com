# How it Works

Paste a public page address on Preview. The tester reads the tags in that
page's head and draws the card each app would show when the link is shared.

## The Tags it Reads

Most apps build that card from Open Graph tags. The ones that matter are
the title, the description, the image, and the page address. They look
like this on the page:

```html
<meta property="og:title" content="Open Graph Tester">
<meta property="og:description" content="A short summary of the page.">
<meta property="og:image" content="https://example.com/card.png">
```

Twitter has its own set, with `twitter:` in the name instead of `og:`.
When a Twitter tag is missing, the Open Graph tag is used. When an Open
Graph title or description is missing, the ordinary page title and
description are used. A missing page address becomes the address you
typed, after any redirect.

## Collected and Processed

Collected Tags are only what the page published.

Processed Tags are that list after the gaps are filled. A value that was
filled in is marked, so you can see it was not on the page. Copy either
block if you want the tags for your own page.

## How the Card is Worked Out

The cards are shown as Facebook, Twitter, LinkedIn, Discord, Slack,
WhatsApp, iMessage, Telegram, Signal, and Teams.

Each card takes the title, description, image, and site name from those
tags and arranges them the way that app does. Facebook, Discord, and
WhatsApp put the image on top and the text underneath. Signal and Teams
put a square image beside the text. Telegram leads with the site name.
Slack puts a thumbnail beside the text, and switches to a full-width
image when the page asks for a large summary card, or when the image is
wide. LinkedIn and iMessage leave the description out. iMessage keeps
the title and the site name under the image.

The image is loaded from the address in the tag. If that address is
missing, or it is not a normal web address, the card says there is no
image.

## What You Can Preview

Public `http` and `https` pages. If you leave the scheme off, the
address is read as `https`. An address with a username or password is
refused, and so is a page on your own machine or on a private network.
