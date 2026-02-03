import { json } from '@sveltejs/kit';

export async function POST({ request }: { request: Request }) {
	try {
		const { url } = await request.json();

		if (!url) {
			return json({ error: 'URL is required' }, { status: 400 });
		}

		let parsedUrl: URL;
		try {
			parsedUrl = new URL(url);
		} catch {
			return json({ error: 'Invalid URL format' }, { status: 400 });
		}

		const response = await fetch(url, {
			headers: {
				'User-Agent': 'Maglev-Validator/1.0',
				Accept: 'application/zip, application/octet-stream, */*'
			}
		});

		if (!response.ok) {
			return json(
				{ error: `Failed to fetch GTFS file: ${response.status} ${response.statusText}` },
				{ status: response.status }
			);
		}

		const arrayBuffer = await response.arrayBuffer();
		const uint8Array = new Uint8Array(arrayBuffer);

		if (
			uint8Array.length < 4 ||
			uint8Array[0] !== 0x50 ||
			uint8Array[1] !== 0x4b ||
			uint8Array[2] !== 0x03 ||
			uint8Array[3] !== 0x04
		) {
			return json({ error: 'The URL does not point to a valid ZIP file' }, { status: 400 });
		}

		return new Response(arrayBuffer, {
			status: 200,
			headers: {
				'Content-Type': 'application/zip',
				'Content-Length': String(arrayBuffer.byteLength)
			}
		});
	} catch (error) {
		console.error('Error fetching GTFS static file:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to fetch GTFS file' },
			{ status: 500 }
		);
	}
}
