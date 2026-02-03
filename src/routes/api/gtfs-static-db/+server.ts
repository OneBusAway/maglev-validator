import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createGtfsStaticFeed,
	createGtfsStaticFile,
	insertGtfsStaticDataBatch,
	getGtfsStaticFeeds,
	getGtfsStaticFiles,
	queryGtfsStaticData,
	deleteGtfsStaticFeed,
	clearGtfsStaticData,
	getGtfsStaticFileInfo,
	executeCustomQuery,
	getGtfsTableNames,
	createGtfsViews,
	recreateLatestFeedViews
} from '$lib/server/db';

function parseCSV(content: string): { columns: string[]; data: Record<string, string>[] } {
	if (content.charCodeAt(0) === 0xfeff) {
		content = content.slice(1);
	}

	const lines = content.split(/\r?\n/).filter((line) => line.trim());
	if (lines.length === 0) return { columns: [], data: [] };

	// Parse header
	const headerLine = lines[0];
	const columns: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < headerLine.length; i++) {
		const char = headerLine[i];
		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === ',' && !inQuotes) {
			columns.push(current.trim());
			current = '';
		} else {
			current += char;
		}
	}
	columns.push(current.trim());

	// Parse data rows
	const data: Record<string, string>[] = [];
	for (let rowIndex = 1; rowIndex < lines.length; rowIndex++) {
		const line = lines[rowIndex];
		const values: string[] = [];
		current = '';
		inQuotes = false;

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

		const row: Record<string, string> = {};
		columns.forEach((col, i) => {
			row[col] = values[i] ?? '';
		});
		data.push(row);
	}

	return { columns, data };
}

export const GET: RequestHandler = async ({ url }) => {
	const action = url.searchParams.get('action');

	try {
		if (action === 'feeds') {
			const feeds = getGtfsStaticFeeds();
			return json({ feeds });
		}

		if (action === 'files') {
			const feedId = parseInt(url.searchParams.get('feedId') || '0');
			if (!feedId) {
				return json({ error: 'feedId required' }, { status: 400 });
			}
			const files = getGtfsStaticFiles(feedId);
			const filesWithColumns = files.map((f) => ({
				...f,
				columns: JSON.parse(f.columns) as string[]
			}));
			return json({ files: filesWithColumns });
		}

		if (action === 'query') {
			const fileId = parseInt(url.searchParams.get('fileId') || '0');
			if (!fileId) {
				return json({ error: 'fileId required' }, { status: 400 });
			}

			const search = url.searchParams.get('search') || undefined;
			const sortColumn = url.searchParams.get('sortColumn') || undefined;
			const sortDirection = (url.searchParams.get('sortDirection') as 'asc' | 'desc') || 'asc';
			const page = parseInt(url.searchParams.get('page') || '1');
			const pageSize = parseInt(url.searchParams.get('pageSize') || '50');

			const result = queryGtfsStaticData({
				fileId,
				search,
				sortColumn,
				sortDirection,
				page,
				pageSize
			});

			return json(result);
		}

		if (action === 'fileInfo') {
			const fileId = parseInt(url.searchParams.get('fileId') || '0');
			if (!fileId) {
				return json({ error: 'fileId required' }, { status: 400 });
			}
			const fileInfo = getGtfsStaticFileInfo(fileId);
			if (!fileInfo) {
				return json({ error: 'File not found' }, { status: 404 });
			}
			return json({
				...fileInfo,
				columns: JSON.parse(fileInfo.columns)
			});
		}

		return json({ error: 'Invalid action' }, { status: 400 });
	} catch (e) {
		console.error('GTFS static GET error:', e);
		return json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();
		const { action } = data;

		if (action === 'upload') {
			const { name, sourceUrl, files } = data as {
				name: string;
				sourceUrl?: string;
				files: Array<{
					filename: string;
					columns: string[];
					data: Record<string, string>[];
				}>;
			};

			const feedId = createGtfsStaticFeed(name, sourceUrl);

			const fileInfos: Array<{
				id: number;
				filename: string;
				columns: string[];
				rowCount: number;
			}> = [];

			for (const file of files) {
				const fileId = createGtfsStaticFile(feedId, file.filename, file.columns, file.data.length);

				if (file.data.length > 0) {
					insertGtfsStaticDataBatch(fileId, file.data);
				}

				fileInfos.push({
					id: fileId,
					filename: file.filename,
					columns: file.columns,
					rowCount: file.data.length
				});
			}

			createGtfsViews(feedId);

			return json({
				success: true,
				feedId,
				files: fileInfos
			});
		}

		if (action === 'uploadRaw') {
			const { name, sourceUrl, files } = data as {
				name: string;
				sourceUrl?: string;
				files: Array<{
					filename: string;
					content: string;
				}>;
			};

			const feedId = createGtfsStaticFeed(name, sourceUrl);

			const fileInfos: Array<{
				id: number;
				filename: string;
				columns: string[];
				rowCount: number;
			}> = [];

			for (const file of files) {
				const { columns, data: rows } = parseCSV(file.content);

				if (columns.length > 0) {
					const fileId = createGtfsStaticFile(feedId, file.filename, columns, rows.length);

					if (rows.length > 0) {
						insertGtfsStaticDataBatch(fileId, rows);
					}

					fileInfos.push({
						id: fileId,
						filename: file.filename,
						columns: columns,
						rowCount: rows.length
					});
				}
			}

			createGtfsViews(feedId);

			return json({
				success: true,
				feedId,
				files: fileInfos
			});
		}

		if (action === 'delete') {
			const { feedId } = data;
			if (!feedId) {
				return json({ error: 'feedId required' }, { status: 400 });
			}
			const deleted = deleteGtfsStaticFeed(feedId);
			return json({ success: true, deleted });
		}

		if (action === 'clear') {
			const deleted = clearGtfsStaticData();
			return json({ success: true, deleted });
		}

		if (action === 'sql') {
			const { query, limit = 1000 } = data as { query: string; limit?: number };
			if (!query || typeof query !== 'string') {
				return json({ error: 'SQL query required' }, { status: 400 });
			}

			const trimmedQuery = query.trim().toLowerCase();
			if (!trimmedQuery.startsWith('select')) {
				return json({ error: 'Only SELECT queries are allowed' }, { status: 400 });
			}

			const dangerousKeywords = [
				'drop',
				'delete',
				'insert',
				'update',
				'alter',
				'create',
				'truncate',
				'exec',
				'execute'
			];
			for (const keyword of dangerousKeywords) {
				if (trimmedQuery.includes(keyword)) {
					return json(
						{ error: `Query contains forbidden keyword: ${keyword.toUpperCase()}` },
						{ status: 400 }
					);
				}
			}

			try {
				const result = executeCustomQuery(query, limit);
				return json(result);
			} catch (e) {
				return json(
					{
						error: e instanceof Error ? e.message : 'Query execution failed',
						sqlError: true
					},
					{ status: 400 }
				);
			}
		}

		if (action === 'tables') {
			const tables = getGtfsTableNames();
			return json({ tables });
		}

		if (action === 'recreateViews') {
			const result = recreateLatestFeedViews();
			return json(result);
		}

		return json({ error: 'Invalid action' }, { status: 400 });
	} catch (e) {
		console.error('GTFS static POST error:', e);
		return json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
	}
};
