# Cloudflare HTTP Echo

A Cloudflare Worker that serves a small, Cloudflare Access-protected country
dashboard. It displays the authenticated user's email, the request time, and a
link for the country Cloudflare detected. Country flag images are served from
Cloudflare R2.

## Routes

All routes require the `cf-access-authenticated-user-email` header supplied by
Cloudflare Access.

| Route | Description |
| --- | --- |
| `/secure` | Dashboard using the country from Cloudflare request metadata |
| `/secure/{country}` | Country page, such as `/secure/gb` |
| `/secure/flag/{country}` | Flag image for the requested country |

The worker supports `US`, `GB`, `DE`, and `BR`; country codes in URLs are
lowercase, such as `/secure/de`. Unknown or missing country codes fall back to
`BR`. Requests without an Access identity receive `401 Unauthorized`;
methods other than `GET` receive `405 Method Not Allowed`.

## Requirements

- Node.js and npm
- A Cloudflare account with Workers, R2, and Cloudflare Access configured
- Wrangler authenticated to your Cloudflare account for deployment

## Setup

Install the dependencies:

```sh
npm install
```

The Wrangler configuration expects an R2 bucket named `adrians-flags`, bound to
the worker as `FLAGS_BUCKET`. Add these objects to that bucket:

| R2 object key | Country |
| --- | --- |
| `us.png` | United States |
| `england.png` | United Kingdom |
| `german.png` | Germany |
| `brazil.png` | Brazil and fallback |

For example, upload a local image with Wrangler:

```sh
npx wrangler r2 object put adrians-flags/brazil.png --file=./brazil.png
```

Repeat the command with the other image names and paths. The image files are
excluded from Git, so provide them locally before uploading.

Configure Cloudflare Access to protect the `/secure` routes on the hostname
specified in `wrangler.jsonc`. The Worker relies on the authenticated email
header added by Cloudflare Access.

Start the local Worker:

```sh
npm run dev
```

Run the test suite:

```sh
npm test -- --run
```

Generate Cloudflare Worker binding types after changing the Wrangler
configuration:

```sh
npm run cf-typegen
```

## Deploy

After configuring the R2 bucket and Cloudflare Access, deploy the Worker:

```sh
npm run deploy
```

The route hostname, Worker entry point, and R2 binding are configured in
[`wrangler.jsonc`](./wrangler.jsonc).
