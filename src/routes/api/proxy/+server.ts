import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function isAbsoluteUrl(url: string): boolean {
	try {
		new URL(url);
		return true;
	} catch {
		return false;
	}
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { url1, url2 } = await request.json();

		if (!isAbsoluteUrl(url1)) {
			return json(
				{
					error: `Invalid URL for server 1: "${url1}" - URL must be absolute (start with http:// or https://)`
				},
				{ status: 400 }
			);
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
			fetch(url1)
				.then(async (r) => ({ data: await r.json(), status: r.status }))
				.catch((e) => ({ data: { error: e.message }, status: 0 })),
			fetch(url2)
				.then(async (r) => ({ data: await r.json(), status: r.status }))
				.catch((e) => ({ data: { error: e.message }, status: 0 }))
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
