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

/** Fetches one URL and reads its body: JSON, or a decoded GTFS-Realtime feed. */
async function fetchForComparison(url: string, api: string | undefined) {
	return fetch(url)
		.then(async (r) => ({
			data: api === 'gtfs_realtime' ? await readGtfsRealtimeResponse(r) : await r.json(),
			status: r.status
		}))
		.catch((e) => ({ data: { error: e.message }, status: 0 }));
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
			const result1 = await fetch(url1)
				.then(async (r) => ({ data: await r.json(), status: r.status }))
				.catch((e) => ({ data: { error: e.message }, status: 0 }));
			return json({
				response1: result1.data,
				response2: null,
				status1: result1.status,
				status2: null
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
			status2: result2.status
		});
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
