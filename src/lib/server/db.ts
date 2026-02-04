import Database from 'better-sqlite3';
import { dev } from '$app/environment';
import path from 'path';

const DB_PATH = dev ? 'keylog.db' : path.join(process.cwd(), 'keylog.db');

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
	if (!db) {
		db = new Database(DB_PATH);
		db.pragma('journal_mode = WAL');
		initializeDatabase(db);
	}
	return db;
}

function initializeDatabase(database: Database.Database) {
	const tableInfo = database.pragma('table_info(key_logs)') as Array<{ name: string }>;
	const hasRequestId = tableInfo.some((col) => col.name === 'request_id');

	if (tableInfo.length > 0 && !hasRequestId) {
		console.log('Migrating database: Dropping old key_logs table to support full response logging');
		database.exec('DROP TABLE IF EXISTS key_logs');
	}

	database.exec(`
		CREATE TABLE IF NOT EXISTS request_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp TEXT NOT NULL,
			endpoint TEXT NOT NULL,
			response1 TEXT,
			response2 TEXT,
			created_at INTEGER DEFAULT (strftime('%s', 'now'))
		);

		CREATE TABLE IF NOT EXISTS key_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			request_id INTEGER,
			timestamp TEXT NOT NULL,
			endpoint TEXT NOT NULL,
			key_path TEXT NOT NULL,
			server1_value TEXT,
			server2_value TEXT,
			created_at INTEGER DEFAULT (strftime('%s', 'now')),
			FOREIGN KEY(request_id) REFERENCES request_logs(id)
		);

		CREATE INDEX IF NOT EXISTS idx_key_logs_lookup
		ON key_logs(endpoint, key_path, timestamp);

		CREATE INDEX IF NOT EXISTS idx_key_logs_created
		ON key_logs(created_at);

		CREATE INDEX IF NOT EXISTS idx_key_logs_request_id
		ON key_logs(request_id);

		CREATE TABLE IF NOT EXISTS gtfs_rt_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			session_id TEXT,
			timestamp TEXT NOT NULL,
			url TEXT NOT NULL,
			header TEXT,
			entities TEXT,
			created_at INTEGER DEFAULT (strftime('%s', 'now'))
		);

		CREATE INDEX IF NOT EXISTS idx_gtfs_rt_logs_timestamp
		ON gtfs_rt_logs(timestamp);

		CREATE TABLE IF NOT EXISTS gtfs_rt_snapshots (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp TEXT NOT NULL,
			data TEXT NOT NULL,
			created_at INTEGER DEFAULT (strftime('%s', 'now'))
		);

		CREATE INDEX IF NOT EXISTS idx_gtfs_rt_snapshots_created
		ON gtfs_rt_snapshots(created_at);

		-- GTFS Static tables
		CREATE TABLE IF NOT EXISTS gtfs_static_feeds (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			source_url TEXT,
			created_at INTEGER DEFAULT (strftime('%s', 'now'))
		);

		CREATE TABLE IF NOT EXISTS gtfs_static_files (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			feed_id INTEGER NOT NULL,
			filename TEXT NOT NULL,
			columns TEXT NOT NULL,
			row_count INTEGER NOT NULL,
			created_at INTEGER DEFAULT (strftime('%s', 'now')),
			FOREIGN KEY(feed_id) REFERENCES gtfs_static_feeds(id) ON DELETE CASCADE
		);

		CREATE INDEX IF NOT EXISTS idx_gtfs_static_files_feed
		ON gtfs_static_files(feed_id);

		CREATE TABLE IF NOT EXISTS gtfs_static_data (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			file_id INTEGER NOT NULL,
			row_data TEXT NOT NULL,
			FOREIGN KEY(file_id) REFERENCES gtfs_static_files(id) ON DELETE CASCADE
		);

		CREATE INDEX IF NOT EXISTS idx_gtfs_static_data_file
		ON gtfs_static_data(file_id);
	`);
}

export interface KeyLogEntry {
	id: number;
	request_id: number | null;
	timestamp: string;
	endpoint: string;
	key_path: string;
	server1_value: string | null;
	server2_value: string | null;
	created_at: number;
}

export interface RequestLogEntry {
	id: number;
	timestamp: string;
	endpoint: string;
	response1: string | null;
	response2: string | null;
	created_at: number;
}

export interface GtfsRtLogEntry {
	id: number;
	session_id: string | null;
	timestamp: string;
	url: string;
	header: string | null;
	entities: string | null;
	created_at: number;
}

export interface GtfsRtSnapshotEntry {
	id: number;
	timestamp: string;
	data: string;
	created_at: number;
}

export interface InsertKeyLogParams {
	timestamp: string;
	endpoint: string;
	key_path: string;
	server1_value: unknown;
	server2_value: unknown;
}

export interface InsertLogBatchParams {
	timestamp: string;
	endpoint: string;
	response1: unknown;
	response2: unknown;
	keys: Array<{
		path: string;
		server1Value: unknown;
		server2Value: unknown;
	}>;
}

export function insertLogBatch(params: InsertLogBatchParams): void {
	const db = getDatabase();

	const insertRequest = db.prepare(`
		INSERT INTO request_logs (timestamp, endpoint, response1, response2)
		VALUES (?, ?, ?, ?)
	`);

	const insertKey = db.prepare(`
		INSERT INTO key_logs (request_id, timestamp, endpoint, key_path, server1_value, server2_value)
		VALUES (?, ?, ?, ?, ?, ?)
	`);

	const transaction = db.transaction(() => {
		const info = insertRequest.run(
			params.timestamp,
			params.endpoint,
			JSON.stringify(params.response1),
			JSON.stringify(params.response2)
		);
		const requestId = info.lastInsertRowid;

		for (const key of params.keys) {
			insertKey.run(
				requestId,
				params.timestamp,
				params.endpoint,
				key.path,
				JSON.stringify(key.server1Value),
				JSON.stringify(key.server2Value)
			);
		}
	});

	transaction();
}

export function insertKeyLogs(entries: InsertKeyLogParams[]): void {
	const db = getDatabase();
	const stmt = db.prepare(`
		INSERT INTO key_logs (timestamp, endpoint, key_path, server1_value, server2_value)
		VALUES (?, ?, ?, ?, ?)
	`);

	const insertMany = db.transaction((items: InsertKeyLogParams[]) => {
		for (const item of items) {
			stmt.run(
				item.timestamp,
				item.endpoint,
				item.key_path,
				JSON.stringify(item.server1_value),
				JSON.stringify(item.server2_value)
			);
		}
	});

	insertMany(entries);
}

export interface GetKeyLogsParams {
	endpoint?: string;
	keyPath?: string | string[];
	since?: string;
	limit?: number;
}

export function getKeyLogs(params: GetKeyLogsParams = {}): KeyLogEntry[] {
	const db = getDatabase();

	let query = 'SELECT * FROM key_logs WHERE 1=1';
	const queryParams: unknown[] = [];

	if (params.endpoint) {
		query += ' AND endpoint = ?';
		queryParams.push(params.endpoint);
	}

	if (params.keyPath) {
		if (Array.isArray(params.keyPath)) {
			if (params.keyPath.length > 0) {
				const placeholders = params.keyPath.map(() => '?').join(',');
				query += ` AND key_path IN (${placeholders})`;
				queryParams.push(...params.keyPath);
			}
		} else {
			query += ' AND key_path = ?';
			queryParams.push(params.keyPath);
		}
	}

	if (params.since) {
		query += ' AND timestamp >= ?';
		queryParams.push(params.since);
	}

	query += ' ORDER BY timestamp DESC, key_path ASC';

	if (params.limit) {
		query += ' LIMIT ?';
		queryParams.push(params.limit);
	}

	const stmt = db.prepare(query);
	return stmt.all(...queryParams) as KeyLogEntry[];
}

export function getLoggedEndpoints(): string[] {
	const db = getDatabase();
	const stmt = db.prepare('SELECT DISTINCT endpoint FROM key_logs ORDER BY endpoint');
	return stmt.all().map((row) => (row as { endpoint: string }).endpoint);
}

export function getLoggedKeyPaths(endpoint: string): string[] {
	const db = getDatabase();
	const stmt = db.prepare(
		'SELECT DISTINCT key_path FROM key_logs WHERE endpoint = ? ORDER BY key_path'
	);
	return stmt.all(endpoint).map((row) => (row as { key_path: string }).key_path);
}

export function clearKeyLogs(endpoint?: string): number {
	const db = getDatabase();

	if (endpoint) {
		const stmt = db.prepare('DELETE FROM key_logs WHERE endpoint = ?');
		return stmt.run(endpoint).changes;
	} else {
		const stmt = db.prepare('DELETE FROM key_logs');
		return stmt.run().changes;
	}
}

export function getKeyLogCount(endpoint?: string, keyPath?: string | string[]): number {
	const db = getDatabase();

	let query = 'SELECT COUNT(*) as count FROM key_logs WHERE 1=1';
	const queryParams: unknown[] = [];

	if (endpoint) {
		query += ' AND endpoint = ?';
		queryParams.push(endpoint);
	}

	if (keyPath) {
		if (Array.isArray(keyPath)) {
			if (keyPath.length > 0) {
				const placeholders = keyPath.map(() => '?').join(',');
				query += ` AND key_path IN (${placeholders})`;
				queryParams.push(...keyPath);
			}
		} else {
			query += ' AND key_path = ?';
			queryParams.push(keyPath);
		}
	}

	const stmt = db.prepare(query);
	return (stmt.get(...queryParams) as { count: number }).count;
}

export function getRequestLog(id: number): RequestLogEntry | undefined {
	const db = getDatabase();
	const stmt = db.prepare('SELECT * FROM request_logs WHERE id = ?');
	return stmt.get(id) as RequestLogEntry | undefined;
}

export function insertGtfsRtLog(params: {
	sessionId?: string;
	timestamp: string;
	url: string;
	header: unknown;
	entities: unknown;
}): void {
	const db = getDatabase();
	const stmt = db.prepare(`
		INSERT INTO gtfs_rt_logs (session_id, timestamp, url, header, entities)
		VALUES (?, ?, ?, ?, ?)
	`);

	stmt.run(
		params.sessionId || null,
		params.timestamp,
		params.url,
		JSON.stringify(params.header),
		JSON.stringify(params.entities)
	);
}

export function getGtfsRtLogs(limit = 100): GtfsRtLogEntry[] {
	const db = getDatabase();
	const stmt = db.prepare('SELECT * FROM gtfs_rt_logs ORDER BY created_at DESC LIMIT ?');
	return stmt.all(limit) as GtfsRtLogEntry[];
}

export function getGtfsRtLog(id: number): GtfsRtLogEntry | undefined {
	const db = getDatabase();
	const stmt = db.prepare('SELECT * FROM gtfs_rt_logs WHERE id = ?');
	return stmt.get(id) as GtfsRtLogEntry | undefined;
}

export function clearGtfsRtLogs(url?: string): number {
	const db = getDatabase();
	if (url) {
		const stmt = db.prepare('DELETE FROM gtfs_rt_logs WHERE url = ?');
		return stmt.run(url).changes;
	} else {
		const stmt = db.prepare('DELETE FROM gtfs_rt_logs');
		return stmt.run().changes;
	}
}

export function insertGtfsRtSnapshot(timestamp: string, data: unknown): void {
	const db = getDatabase();
	const stmt = db.prepare(`
		INSERT INTO gtfs_rt_snapshots (timestamp, data)
		VALUES (?, ?)
	`);
	stmt.run(timestamp, JSON.stringify(data));
}

export interface GetGtfsRtSnapshotsParams {
	since?: string;
	limit?: number;
}

export function getGtfsRtSnapshots(params: GetGtfsRtSnapshotsParams = {}): GtfsRtSnapshotEntry[] {
	const db = getDatabase();

	let query = 'SELECT * FROM gtfs_rt_snapshots WHERE 1=1';
	const queryParams: unknown[] = [];

	if (params.since) {
		query += ' AND timestamp >= ?';
		queryParams.push(params.since);
	}

	query += ' ORDER BY created_at DESC';

	if (params.limit) {
		query += ' LIMIT ?';
		queryParams.push(params.limit);
	}

	const stmt = db.prepare(query);
	return stmt.all(...queryParams) as GtfsRtSnapshotEntry[];
}

export function deleteGtfsRtSnapshot(id: number): number {
	const db = getDatabase();
	const stmt = db.prepare('DELETE FROM gtfs_rt_snapshots WHERE id = ?');
	return stmt.run(id).changes;
}

export function clearGtfsRtSnapshots(): number {
	const db = getDatabase();
	const stmt = db.prepare('DELETE FROM gtfs_rt_snapshots');
	return stmt.run().changes;
}

export interface GtfsStaticFeed {
	id: number;
	name: string;
	source_url: string | null;
	created_at: number;
}

export interface GtfsStaticFile {
	id: number;
	feed_id: number;
	filename: string;
	columns: string;
	row_count: number;
	created_at: number;
}

export interface GtfsStaticDataRow {
	id: number;
	file_id: number;
	row_data: string;
}

export function createGtfsStaticFeed(name: string, sourceUrl?: string): number {
	const db = getDatabase();
	const stmt = db.prepare(`
		INSERT INTO gtfs_static_feeds (name, source_url)
		VALUES (?, ?)
	`);
	const info = stmt.run(name, sourceUrl || null);
	return info.lastInsertRowid as number;
}

export function getGtfsStaticFeeds(): GtfsStaticFeed[] {
	const db = getDatabase();
	const stmt = db.prepare('SELECT * FROM gtfs_static_feeds ORDER BY created_at DESC');
	return stmt.all() as GtfsStaticFeed[];
}

export function deleteGtfsStaticFeed(feedId: number): number {
	const db = getDatabase();
	const stmt = db.prepare('DELETE FROM gtfs_static_feeds WHERE id = ?');
	return stmt.run(feedId).changes;
}

export function createGtfsStaticFile(
	feedId: number,
	filename: string,
	columns: string[],
	rowCount: number
): number {
	const db = getDatabase();
	const stmt = db.prepare(`
		INSERT INTO gtfs_static_files (feed_id, filename, columns, row_count)
		VALUES (?, ?, ?, ?)
	`);
	const info = stmt.run(feedId, filename, JSON.stringify(columns), rowCount);
	return info.lastInsertRowid as number;
}

export function getGtfsStaticFiles(feedId: number): GtfsStaticFile[] {
	const db = getDatabase();
	const stmt = db.prepare('SELECT * FROM gtfs_static_files WHERE feed_id = ? ORDER BY filename');
	return stmt.all(feedId) as GtfsStaticFile[];
}

export function insertGtfsStaticDataBatch(fileId: number, rows: Record<string, string>[]): void {
	const db = getDatabase();
	const stmt = db.prepare(`
		INSERT INTO gtfs_static_data (file_id, row_data)
		VALUES (?, ?)
	`);

	const batchSize = 1000;
	const insertBatch = db.transaction((batch: Record<string, string>[]) => {
		for (const row of batch) {
			stmt.run(fileId, JSON.stringify(row));
		}
	});

	// Insert in batches to avoid memory issues
	for (let i = 0; i < rows.length; i += batchSize) {
		const batch = rows.slice(i, i + batchSize);
		insertBatch(batch);
	}
}

export interface QueryGtfsStaticDataParams {
	fileId: number;
	search?: string;
	searchColumns?: string[];
	sortColumn?: string;
	sortDirection?: 'asc' | 'desc';
	page?: number;
	pageSize?: number;
}

export interface QueryGtfsStaticDataResult {
	rows: Record<string, string>[];
	totalCount: number;
	page: number;
	pageSize: number;
	totalPages: number;
}

export function queryGtfsStaticData(params: QueryGtfsStaticDataParams): QueryGtfsStaticDataResult {
	const db = getDatabase();
	const {
		fileId,
		search,
		searchColumns,
		sortColumn,
		sortDirection = 'asc',
		page = 1,
		pageSize = 50
	} = params;

	let countQuery = 'SELECT COUNT(*) as count FROM gtfs_static_data WHERE file_id = ?';
	const countParams: unknown[] = [fileId];

	if (search && search.trim()) {
		countQuery += ' AND row_data LIKE ?';
		countParams.push(`%${search}%`);
	}

	const countStmt = db.prepare(countQuery);
	const totalCount = (countStmt.get(...countParams) as { count: number }).count;

	let dataQuery = 'SELECT row_data FROM gtfs_static_data WHERE file_id = ?';
	const dataParams: unknown[] = [fileId];

	if (search && search.trim()) {
		dataQuery += ' AND row_data LIKE ?';
		dataParams.push(`%${search}%`);
	}

	const offset = (page - 1) * pageSize;
	dataQuery += ' LIMIT ? OFFSET ?';
	dataParams.push(pageSize, offset);

	const dataStmt = db.prepare(dataQuery);
	const rawRows = dataStmt.all(...dataParams) as { row_data: string }[];

	let rows = rawRows.map((r) => JSON.parse(r.row_data) as Record<string, string>);

	if (sortColumn) {
		rows.sort((a, b) => {
			const aVal = a[sortColumn] || '';
			const bVal = b[sortColumn] || '';

			const aNum = parseFloat(aVal);
			const bNum = parseFloat(bVal);
			if (!isNaN(aNum) && !isNaN(bNum)) {
				return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
			}

			const cmp = aVal.localeCompare(bVal);
			return sortDirection === 'asc' ? cmp : -cmp;
		});
	}

	return {
		rows,
		totalCount,
		page,
		pageSize,
		totalPages: Math.ceil(totalCount / pageSize) || 1
	};
}

export function getGtfsStaticFileInfo(fileId: number): GtfsStaticFile | undefined {
	const db = getDatabase();
	const stmt = db.prepare('SELECT * FROM gtfs_static_files WHERE id = ?');
	return stmt.get(fileId) as GtfsStaticFile | undefined;
}

export function clearGtfsStaticData(): number {
	const db = getDatabase();
	db.exec('DELETE FROM gtfs_static_data');
	db.exec('DELETE FROM gtfs_static_files');
	const stmt = db.prepare('DELETE FROM gtfs_static_feeds');
	return stmt.run().changes;
}

export interface CustomQueryResult {
	columns: string[];
	rows: Record<string, unknown>[];
	rowCount: number;
	executionTime: number;
	truncated: boolean;
}

export function executeCustomQuery(query: string, limit: number = 1000): CustomQueryResult {
	const db = getDatabase();
	const startTime = performance.now();

	let cleanQuery = query.trim();
	while (cleanQuery.endsWith(';')) {
		cleanQuery = cleanQuery.slice(0, -1).trim();
	}

	let finalQuery = cleanQuery;
	if (!cleanQuery.toLowerCase().includes(' limit ')) {
		finalQuery = `${cleanQuery} LIMIT ${limit + 1}`;
	}

	const stmt = db.prepare(finalQuery);
	const rawRows = stmt.all() as Record<string, unknown>[];

	const executionTime = performance.now() - startTime;

	const truncated = rawRows.length > limit;
	const rows = truncated ? rawRows.slice(0, limit) : rawRows;

	const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

	return {
		columns,
		rows,
		rowCount: rows.length,
		executionTime: Math.round(executionTime * 100) / 100,
		truncated
	};
}

export interface GtfsTableInfo {
	name: string;
	displayName: string;
	columns: string[];
	rowCount: number;
}

export function getGtfsTableNames(feedId?: number): GtfsTableInfo[] {
	const db = getDatabase();

	let targetFeedId = feedId;
	if (!targetFeedId) {
		const latestFeed = db
			.prepare(
				`
			SELECT id FROM gtfs_static_feeds ORDER BY created_at DESC LIMIT 1
		`
			)
			.get() as { id: number } | undefined;
		targetFeedId = latestFeed?.id;
	}

	if (!targetFeedId) {
		return [];
	}

	const files = db
		.prepare(
			`
		SELECT f.id, f.filename, f.columns, f.row_count
		FROM gtfs_static_files f
		WHERE f.feed_id = ?
		ORDER BY f.filename
	`
		)
		.all(targetFeedId) as { id: number; filename: string; columns: string; row_count: number }[];

	return files.map((f) => {
		const columns = JSON.parse(f.columns) as string[];
		const tableName = f.filename.replace('.txt', '');
		return {
			name: tableName,
			displayName: f.filename,
			columns,
			rowCount: f.row_count
		};
	});
}

export function createGtfsViews(feedId: number): void {
	const db = getDatabase();

	const files = db
		.prepare(
			`
		SELECT id, filename, columns FROM gtfs_static_files WHERE feed_id = ?
	`
		)
		.all(feedId) as { id: number; filename: string; columns: string }[];

	const existingViews = db
		.prepare(
			`
		SELECT name FROM sqlite_master WHERE type='view'
	`
		)
		.all() as { name: string }[];

	for (const view of existingViews) {
		try {
			db.exec(`DROP VIEW IF EXISTS "${view.name}"`);
		} catch {}
	}

	for (const file of files) {
		const columns = JSON.parse(file.columns) as string[];
		const viewName = file.filename.replace('.txt', '');

		const columnExprs = columns
			.map((col) => `json_extract(row_data, '$.${col}') as "${col}"`)
			.join(', ');

		const viewQuery = `
			CREATE VIEW "${viewName}" AS
			SELECT ${columnExprs}
			FROM gtfs_static_data
			WHERE file_id = ${file.id}
		`;

		try {
			db.exec(viewQuery);
			console.log(`Created view: ${viewName}`);
		} catch (e) {
			console.warn(`Failed to create view ${viewName}:`, e);
		}
	}
}

export function recreateLatestFeedViews(): {
	success: boolean;
	feedId?: number;
	viewCount?: number;
} {
	const db = getDatabase();

	const latestFeed = db
		.prepare(
			`
		SELECT id FROM gtfs_static_feeds ORDER BY created_at DESC LIMIT 1
	`
		)
		.get() as { id: number } | undefined;

	if (!latestFeed) {
		return { success: false };
	}

	createGtfsViews(latestFeed.id);

	const views = db
		.prepare(
			`
		SELECT COUNT(*) as count FROM sqlite_master WHERE type='view'
	`
		)
		.get() as { count: number };

	return {
		success: true,
		feedId: latestFeed.id,
		viewCount: views.count
	};
}
