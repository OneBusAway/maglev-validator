import { SvelteSet } from 'svelte/reactivity';
import { endpoints } from '$lib/endpoints';

export class ComparatorState {
	server1Base = $state('http://localhost:4000/api/where/');
	server2Base = $state('https://unitrans-api.server.onebusawaycloud.com/api/where/');
	selectedEndpoint = $state(endpoints[0].id);
	params: Record<string, string> = $state({});
	endpointParams: Record<string, Record<string, string>> = $state({});
	lastEndpoint = $state('');

	response1: unknown = $state(null);
	response2: unknown = $state(null);
	loading = $state(false);
	error: string | null | undefined = $state(undefined);

	currentUrl1 = $state('');
	currentUrl2 = $state('');

	showIgnoreModal = $state(false);
	ignoreSearch = $state('');
	showWatchModal = $state(false);
	ignoredKeysInput = $state('');
	watchedKeysInput = $state('');
	watchSearch = $state('');
	focusPaths = $state<string[]>([]);
	focusPathSearch = $state('');
	focusSuggestions = $state<string[]>([]);
	showFocusSuggestions = $state(false);
	focusPath = $state('');
	isExpanded = $state(false);

	toggleWatchKey(key: string) {
		const current = new SvelteSet(
			this.watchedKeysInput
				.split(',')
				.map((k) => k.trim())
				.filter((k) => k.length > 0)
		);
		if (current.has(key)) {
			current.delete(key);
		} else {
			current.add(key);
		}
		this.watchedKeysInput = Array.from(current).join(', ');
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(`watch_${this.selectedEndpoint}`, this.watchedKeysInput);
		}
	}

	autoRefresh = $state(false);
	refreshInterval = $state(5);
	lastLoggedTime = $state<number | null>(null);
	refreshTimer: number | undefined = undefined;
	numericTolerancePercent = $state(0);
}

export interface ProtobufFeedData {
	header: unknown;
	tripUpdates: unknown[];
	vehiclePositions: unknown[];
	alerts: unknown[];
	entityCount: number;
	totals: {
		tripUpdates: number;
		vehiclePositions: number;
		alerts: number;
	};
	limited: {
		tripUpdates: boolean;
		vehiclePositions: boolean;
		alerts: boolean;
	};
}

export class ProtobufState {
	tripUpdatesUrl = $state('');
	vehiclePositionsUrl = $state('');
	serviceAlertsUrl = $state('');
	headers = $state<{ key: string; value: string }[]>([{ key: '', value: '' }]);

	loading = $state(false);
	error = $state<string | undefined>(undefined);
	feedData: ProtobufFeedData | null = $state(null);

	paginationState = $state({
		hasMore: { tripUpdates: false, vehiclePositions: false, alerts: false },
		loading: { tripUpdates: false, vehiclePositions: false, alerts: false }
	});

	currentFetchUrls = $state({
		tripUpdates: '',
		vehiclePositions: '',
		alerts: ''
	});

	autoRefresh = $state(false);
	refreshInterval = $state(30);
	loggingEnabled = $state(true);
	lastFetchTime = $state<Date | null>(null);
	refreshTimer: number | undefined = undefined;

	searchQuery = $state('');
	debouncedQuery = $state('');
	activeTab = $state<'tripUpdates' | 'vehiclePositions' | 'alerts' | 'header' | 'rawText'>(
		'tripUpdates'
	);
}

export interface GtfsFile {
	id: number;
	name: string;
	columns: string[];
	rowCount: number;
}

export class GtfsStaticState {
	gtfsFiles: GtfsFile[] = $state([]);
	feedId = $state<number | null>(null);

	selectedFileId = $state<number | null>(null);
	currentPage = $state(1);
	pageSize = $state(50);
	totalPages = $state(1);
	totalRows = $state(0);

	headers = $state<string[]>([]);
	rows: Record<string, unknown>[] = $state([]);
	loadingData = $state(false);
	error: string | undefined | null = $state(undefined);

	convertTimes = $state(true);
	convertDates = $state(true);

	activeTab = $state<'browser' | 'sql'>('browser');
	sqlQuery = $state('SELECT * FROM stops LIMIT 100');
	sqlResult = $state<{
		columns: string[];
		rows: Record<string, unknown>[];
		error?: string;
		executionTime?: number;
		rowCount?: number;
		truncated?: boolean;
	} | null>(null);

	showGtfsInput = $state(true);
	isSearching = $state(false);
	searchQuery = $state('');
	isLoadingKeywords = $state(false);

	feedUrl = $state('');
	loading = $state(false);
	uploadProgress = $state('');
	uploadProgressPercent = $state(0);
	currentProcessingFile = $state('');

	selectedFileName = $state<string | null>(null);

	sortColumn = $state<string | null>(null);
	sortDirection = $state<'asc' | 'desc'>('asc');

	sqlError = $state<string | null>(null);
	sqlLoading = $state(false);
	availableTables = $state<
		Array<{ name: string; displayName: string; columns: string[]; rowCount: number }>
	>([]);
	queryHistory = $state<string[]>([]);
	favoriteQueries = $state<Array<{ name: string; query: string }>>([]);
	showSaveFavoriteModal = $state(false);
	newFavoriteName = $state('');
	sqlResultSearch = $state('');
	sqlResultPage = $state(1);
	sqlResultPageSize = $state(50);
}

export interface KeyLogEntry {
	id: number;
	request_id?: number | null;
	timestamp: string;
	endpoint: string;
	key_path: string;
	server1_value: unknown;
	server2_value: unknown;
	created_at: number;
}

export class LoggerState {
	selectedEndpoint = $state('');
	logs = $state<KeyLogEntry[]>([]);
	loading = $state(false);
	totalCount = $state(0);
	limit = $state(100);
	timeRange = $state<'live' | '1h' | '24h' | 'all'>('live');
	filterMode = $state<'all' | 'match' | 'mismatch'>('all');

	keyPaths = $state<string[]>([]);
	selectedKeyPaths = $state(new SvelteSet<string>());
}

export interface GtfsRtSnapshotEntry {
	id: number;
	timestamp: string;
	data: string;
	created_at: number;
}

export class GtfsRtLogState {
	snapshots = $state<GtfsRtSnapshotEntry[]>([]);
	loading = $state(false);
	limit = $state(100);
	timeRange = $state<'live' | '1h' | '24h' | 'all'>('live');
	totalSnapshots = $state<number | null>(null);
}

export const comparatorState = new ComparatorState();
export const protobufState = new ProtobufState();
export const gtfsStaticState = new GtfsStaticState();
export const loggerState = new LoggerState();
export const gtfsRtLogState = new GtfsRtLogState();
