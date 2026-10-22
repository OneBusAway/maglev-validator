import { json } from '@sveltejs/kit';
import { readGtfsRealtimeResponse } from '$lib/server/gtfsRealtimeFeed';
import type { RequestHandler } from './$types';

function isAbsoluteUrl(url: string): boolean {
	try {
		new URL(url);
		return true;
	} catch {
		return false;
	}
}

/**
 * Fetches one URL and reads its body: JSON, or a decoded GTFS-Realtime feed.
 * durationMs covers sending the request through downloading the whole body,
 * not decoding it, so it reflects only the upstream server and network.
 */
async function fetchForComparison(url: string, api: string | undefined) {
	const start = performance.now();
	const elapsed = () => Math.round(performance.now() - start);
	// Set once the body is downloaded, so a decoding failure does not count.
	let durationMs: number | undefined;
	try {
		const r = await fetch(url);
		const body = await r.arrayBuffer();
		durationMs = elapsed();
		const data =
			api === 'gtfs_realtime'
				? await readGtfsRealtimeResponse(
						// A 204/304 must not be given a body, even an empty one.
						new Response(body.byteLength ? body : null, { status: r.status, headers: r.headers })
					)
				: JSON.parse(new TextDecoder().decode(body));
		return { data, status: r.status, durationMs };
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return { data: { error: message }, status: 0, durationMs: durationMs ?? elapsed() };
	}
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { url1, url2, api } = await request.json();

		if (!isAbsoluteUrl(url1)) {
			return json(
				{
					error: `Invalid URL for server 1: "${url1}" - URL must be absolute (start with http:// or https://)`
				},
				{ status: 400 }
			);
		}

		if (url2 == null) {
			const result1 = await fetchForComparison(url1, api);
			return json({
				response1: result1.data,
				response2: null,
				status1: result1.status,
				status2: null,
				duration1: result1.durationMs,
				duration2: null
			});
		}

		if (!isAbsoluteUrl(url2)) {
			return json(
				{
					error: `Invalid URL for server 2: "${url2}" - URL must be absolute (start with http:// or https://)`
				},
				{ status: 400 }
			);
		}

		const [result1, result2] = await Promise.all([
			fetchForComparison(url1, api),
			fetchForComparison(url2, api)
		]);

		return json({
			response1: result1.data,
			response2: result2.data,
			status1: result1.status,
			status2: result2.status,
			duration1: result1.durationMs,
			duration2: result2.durationMs
		});
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
