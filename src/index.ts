// Only countries with a corresponding R2 object are displayed; all others use Brazil.
const flagKeys: Record<string, string> = {
  US: "us.png",
  GB: "england.png",
  DE: "german.png",
  BR: "brazil.png",
};
const htmlEntities: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};

function escapeHtml(text: string): string {
  // The email comes from a request header, so escape it before inserting it into HTML.
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] ?? char);
}

function countryCode(value: unknown): string {
  const code = typeof value === "string" ? value.toUpperCase() : "";
  return Object.hasOwn(flagKeys, code) ? code : "BR";
}

function htmlResponse(title: string, body: string): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${body}</body></html>`,
    {
      headers: {
        "Content-Type": "text/html;charset=UTF-8",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const authenticatedEmail = request.headers.get("cf-access-authenticated-user-email");
    if (!authenticatedEmail) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (request.method !== "GET") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET" },
      });
    }

    const pathname = new URL(request.url).pathname;
    const flagMatch = pathname.match(/^\/secure\/flag\/([A-Z]{2})$/i);
    if (flagMatch) {
      // Resolve the requested flag through the fixed key map; never use a URL path as an R2 key.
      const flag = await env.FLAGS_BUCKET.get(flagKeys[countryCode(flagMatch[1])]);
      if (!flag) {
        return new Response("Flag image not found", { status: 404 });
      }

      const headers = new Headers();
      flag.writeHttpMetadata(headers);
      headers.set("Content-Type", headers.get("Content-Type") ?? "image/png");
      headers.set("Cache-Control", "public, max-age=3600");
      headers.set("X-Content-Type-Options", "nosniff");
      return new Response(flag.body, { headers });
    }

    const countryMatch = pathname.match(/^\/secure\/([A-Z]{2})$/i);
    if (countryMatch) {
      const country = countryCode(countryMatch[1]);
      return htmlResponse(
        `Country View - ${country}`,
        `<h1>Country: ${country}</h1>
        <img src="/secure/flag/${country.toLowerCase()}" alt="${country} flag">
        <p><a href="/secure">Back to dashboard</a></p>`,
      );
    }

    if (pathname === "/secure" || pathname === "/secure/") {
      const country = countryCode(request.cf?.country);
      return htmlResponse(
        "Secure Dashboard",
        `<p>${escapeHtml(authenticatedEmail)} authenticated at ${new Date().toUTCString()} from
        <a href="/secure/${country.toLowerCase()}">${country}</a></p>`,
      );
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
