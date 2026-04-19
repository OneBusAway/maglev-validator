import { json } from '@sveltejs/kit';
import JSZip from 'jszip';
import {
	createGtfsStaticFeed,
	createGtfsStaticFile,
	insertGtfsStaticDataBatch
} from '$lib/server/db';

export async function POST({ request }: { request: Request }) {
	const contentType = request.headers.get('content-type') || '';

	if (contentType.includes('application/octet-stream') || contentType.includes('application/zip')) {
		return handleDirectZipUpload(request);
	}

	if (contentType.includes('multipart/form-data')) {
		return handleFileUpload(request);
	}

	return handleUrlFetch(request);
}

async function handleFileUpload(request: Request) {
	try {
		const formData = await request.formData();
		const file = formData.get('file') as File | null;

		if (!file) {
			return json({ error: 'No file provided' }, { status: 400 });
		}

		if (file.size > 200 * 1024 * 1024) {
			return json({ error: 'File too large. Maximum 200MB allowed.' }, { status: 413 });
		}

		const uint8Array = new Uint8Array(await file.arrayBuffer());

		if (
			uint8Array.length < 4 ||
			uint8Array[0] !== 0x50 ||
			uint8Array[1] !== 0x4b ||
			uint8Array[2] !== 0x03 ||
			uint8Array[3] !== 0x04
		) {
			return json({ error: 'Invalid ZIP file' }, { status: 400 });
		}

		return processZip(uint8Array, file.name, '');
	} catch (error) {
		console.error('File upload error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to process file' },
			{ status: 500 }
		);
	}
}

async function handleDirectZipUpload(request: Request) {
	const contentLength = request.headers.get('content-length');
	const filename = request.headers.get('x-original-filename') || 'gtfs.zip';
	const sourceUrl = request.headers.get('x-source-url') || '';

	if (!contentLength || parseInt(contentLength) > 200 * 1024 * 1024) {
		return json({ error: 'File too large. Maximum 200MB allowed.' }, { status: 413 });
	}

	try {
		const chunks: Uint8Array[] = [];
		const reader = request.body?.getReader();
		if (!reader) {
			return json({ error: 'Cannot read request body' }, { status: 400 });
		}

		let receivedBytes = 0;

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value) {
				chunks.push(value);
				receivedBytes += value.length;
			}
		}

		const uint8Array = new Uint8Array(receivedBytes);
		let offset = 0;
		for (const chunk of chunks) {
			uint8Array.set(chunk, offset);
			offset += chunk.length;
		}

		return processZip(uint8Array, filename, sourceUrl);
	} catch (error) {
		console.error('Direct ZIP upload error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to process ZIP' },
			{ status: 500 }
		);
	}
}

async function handleUrlFetch(request: Request) {
	try {
		const { url } = await request.json();

		if (!url) {
			return json({ error: 'URL is required' }, { status: 400 });
		}

		try {
			new URL(url);
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
				{ error: `Failed to fetch: ${response.status} ${response.statusText}` },
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

		const filename = url.split('/').pop() || 'gtfs.zip';
		return processZip(uint8Array, filename, url);
	} catch (error) {
		console.error('URL fetch error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to fetch GTFS file' },
			{ status: 500 }
		);
	}
}

async function processZip(uint8Array: Uint8Array, filename: string, sourceUrl: string) {
	if (
		uint8Array[0] !== 0x50 ||
		uint8Array[1] !== 0x4b ||
		uint8Array[2] !== 0x03 ||
		uint8Array[3] !== 0x04
	) {
		return json({ error: 'Invalid ZIP file' }, { status: 400 });
	}

	const zip = await JSZip.loadAsync(uint8Array);
	const txtFiles = Object.entries(zip.files).filter(([name, entry]) => {
		if (entry.dir) return false;
		const baseName = name.split('/').pop() || name;
		return baseName.endsWith('.txt');
	});

	if (txtFiles.length === 0) {
		return json({ error: 'No GTFS txt files found in ZIP' }, { status: 400 });
	}

	const feedName = filename.replace(/\.zip$/i, '');
	const feedId = createGtfsStaticFeed(feedName, sourceUrl);

	const fileInfos: Array<{ id: number; filename: string; rowCount: number }> = [];

	for (const [fullPath, entry] of txtFiles) {
		const baseName = fullPath.split('/').pop() || fullPath;
		const content = await entry.async('string');
		const lines = content.split(/\r?\n/).filter((l) => l.trim());

		if (lines.length === 0) continue;

		const headerLine = lines[0];
		const columns = headerLine.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));

		const dataRows: Record<string, string>[] = [];
		for (let i = 1; i < lines.length; i++) {
			const values = parseCSVLine(lines[i]);
			const row: Record<string, string> = {};
			columns.forEach((col, idx) => {
				row[col] = values[idx] || '';
			});
			dataRows.push(row);
		}

		const fileId = createGtfsStaticFile(feedId, baseName, columns, dataRows.length);

		if (dataRows.length > 0) {
			insertGtfsStaticDataBatch(fileId, dataRows);
		}

		fileInfos.push({ id: fileId, filename: baseName, rowCount: dataRows.length });
	}

	return json({
		success: true,
		feedId,
		feedName,
		files: fileInfos
	});
}

function parseCSVLine(line: string): string[] {
	const values: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === ',' && !inQuotes) {
			values.push(current);
			current = '';
		} else {
			current += char;
		}
	}
	values.push(current);

	return values.map((v) => v.trim().replace(/^"|"$/g, ''));
}
