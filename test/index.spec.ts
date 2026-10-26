import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

async function putFlag(key: string, content: string): Promise<void> {
	await env.FLAGS_BUCKET.put(key, content, {
		httpMetadata: { contentType: "image/png" },
	});
}

async function dashboardForCountry(country?: string, email?: string): Promise<string> {
	const request = new IncomingRequest("https://example.com/secure", {
		headers: { "cf-access-authenticated-user-email": email ?? "customer@example.com" },
	});
	Object.defineProperty(request, "cf", { value: { country } });

	const response = await worker.fetch(request, env);
	return response.text();
}

describe("Country dashboard", () => {
	it("loads the supported customer's flag from R2", async () => {
		await putFlag("england.png", "test image bytes");

		const html = await dashboardForCountry("GB");

		expect(html).toMatch(
			/customer@example\.com authenticated at .+ from\s+<a href="\/secure\/gb">GB<\/a>/,
		);
		expect(html).not.toContain("<img");

		const countryPage = await worker.fetch(
			new Request("https://example.com/secure/gb", {
				headers: { "cf-access-authenticated-user-email": "customer@example.com" },
			}),
			env,
		);
		expect(await countryPage.text()).toContain(
			'<img src="/secure/flag/gb" alt="GB flag">',
		);

		const response = await worker.fetch(
			new Request("https://example.com/secure/flag/gb", {
				headers: { "cf-access-authenticated-user-email": "customer@example.com" },
			}),
			env,
		);
		expect(response.headers.get("Content-Type")).toBe("image/png");
		expect(new TextDecoder().decode(await response.arrayBuffer())).toBe("test image bytes");
	});

	it("escapes the Access email before rendering it as HTML", async () => {
		const html = await dashboardForCountry("GB", '<script>alert("x")</script>');

		expect(html).toContain(
			"&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; authenticated at",
		);
		expect(html).not.toContain("<script>");
	});

	it("uses the Brazil image from R2 for an unsupported location", async () => {
		await putFlag("brazil.png", "brazil image bytes");

		const html = await dashboardForCountry("FR");

		expect(html).toContain('href="/secure/br">BR</a>');
		expect(html).not.toContain("<img");
	});

	it("uses the Brazil image from R2 when Cloudflare has no country", async () => {
		await putFlag("brazil.png", "brazil image bytes");

		const html = await dashboardForCountry();

		expect(html).toContain('href="/secure/br">BR</a>');
		expect(html).not.toContain("<img");
	});

	it("rejects methods other than GET", async () => {
		const response = await worker.fetch(
			new Request("https://example.com/secure", {
				method: "POST",
				headers: { "cf-access-authenticated-user-email": "customer@example.com" },
			}),
			env,
		);

		expect(response.status).toBe(405);
		expect(response.headers.get("Allow")).toBe("GET");
	});

	it("rejects requests without a Cloudflare Access identity", async () => {
		const response = await worker.fetch(
			new Request("https://example.com/secure"),
			env,
		);

		expect(response.status).toBe(401);
	});
});
