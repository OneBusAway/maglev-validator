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
	keyPath?: string;
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
		query += ' AND key_path = ?';
		queryParams.push(params.keyPath);
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


export function getKeyLogCount(endpoint?: string): number {
	const db = getDatabase();

	if (endpoint) {
		const stmt = db.prepare('SELECT COUNT(*) as count FROM key_logs WHERE endpoint = ?');
		return (stmt.get(endpoint) as { count: number }).count;
	} else {
		const stmt = db.prepare('SELECT COUNT(*) as count FROM key_logs');
		return (stmt.get() as { count: number }).count;
	}
}


export function getRequestLog(id: number): RequestLogEntry | undefined {
	const db = getDatabase();
	const stmt = db.prepare('SELECT * FROM request_logs WHERE id = ?');
	return stmt.get(id) as RequestLogEntry | undefined;
}
