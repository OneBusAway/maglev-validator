<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import SqlEditor from './SqlEditor.svelte';
	import { gtfsStaticState as gtfsState, type GtfsFile } from '$lib/panelState.svelte';

	const GTFS_FILES: Record<string, { required: boolean; description: string; columns: string[] }> =
		{
			'agency.txt': {
				required: true,
				description: 'Transit agencies',
				columns: [
					'agency_id',
					'agency_name',
					'agency_url',
					'agency_timezone',
					'agency_lang',
					'agency_phone',
					'agency_fare_url',
					'agency_email'
				]
			},
			'stops.txt': {
				required: true,
				description: 'Stop locations',
				columns: [
					'stop_id',
					'stop_code',
					'stop_name',
					'stop_desc',
					'stop_lat',
					'stop_lon',
					'zone_id',
					'stop_url',
					'location_type',
					'parent_station',
					'stop_timezone',
					'wheelchair_boarding',
					'level_id',
					'platform_code'
				]
			},
			'routes.txt': {
				required: true,
				description: 'Transit routes',
				columns: [
					'route_id',
					'agency_id',
					'route_short_name',
					'route_long_name',
					'route_desc',
					'route_type',
					'route_url',
					'route_color',
					'route_text_color',
					'route_sort_order',
					'continuous_pickup',
					'continuous_drop_off'
				]
			},
			'trips.txt': {
				required: true,
				description: 'Trips for routes',
				columns: [
					'route_id',
					'service_id',
					'trip_id',
					'trip_headsign',
					'trip_short_name',
					'direction_id',
					'block_id',
					'shape_id',
					'wheelchair_accessible',
					'bikes_allowed'
				]
			},
			'stop_times.txt': {
				required: true,
				description: 'Arrival/departure times',
				columns: [
					'trip_id',
					'arrival_time',
					'departure_time',
					'stop_id',
					'stop_sequence',
					'stop_headsign',
					'pickup_type',
					'drop_off_type',
					'continuous_pickup',
					'continuous_drop_off',
					'shape_dist_traveled',
					'timepoint'
				]
			},
			'calendar.txt': {
				required: false,
				description: 'Service dates by day of week',
				columns: [
					'service_id',
					'monday',
					'tuesday',
					'wednesday',
					'thursday',
					'friday',
					'saturday',
					'sunday',
					'start_date',
					'end_date'
				]
			},
			'calendar_dates.txt': {
				required: false,
				description: 'Service exceptions',
				columns: ['service_id', 'date', 'exception_type']
			},
			'fare_attributes.txt': {
				required: false,
				description: 'Fare information',
				columns: [
					'fare_id',
					'price',
					'currency_type',
					'payment_method',
					'transfers',
					'agency_id',
					'transfer_duration'
				]
			},
			'fare_rules.txt': {
				required: false,
				description: 'Fare rules for routes',
				columns: ['fare_id', 'route_id', 'origin_id', 'destination_id', 'contains_id']
			},
			'shapes.txt': {
				required: false,
				description: 'Route shapes/paths',
				columns: [
					'shape_id',
					'shape_pt_lat',
					'shape_pt_lon',
					'shape_pt_sequence',
					'shape_dist_traveled'
				]
			},
			'frequencies.txt': {
				required: false,
				description: 'Headway-based schedules',
				columns: ['trip_id', 'start_time', 'end_time', 'headway_secs', 'exact_times']
			},
			'transfers.txt': {
				required: false,
				description: 'Transfer rules',
				columns: [
					'from_stop_id',
					'to_stop_id',
					'from_route_id',
					'to_route_id',
					'from_trip_id',
					'to_trip_id',
					'transfer_type',
					'min_transfer_time'
				]
			},
			'pathways.txt': {
				required: false,
				description: 'Station pathways',
				columns: [
					'pathway_id',
					'from_stop_id',
					'to_stop_id',
					'pathway_mode',
					'is_bidirectional',
					'length',
					'traversal_time',
					'stair_count',
					'max_slope',
					'min_width',
					'signposted_as',
					'reversed_signposted_as'
				]
			},
			'levels.txt': {
				required: false,
				description: 'Station levels',
				columns: ['level_id', 'level_index', 'level_name']
			},
			'feed_info.txt': {
				required: false,
				description: 'Feed metadata',
				columns: [
					'feed_publisher_name',
					'feed_publisher_url',
					'feed_lang',
					'default_lang',
					'feed_start_date',
					'feed_end_date',
					'feed_version',
					'feed_contact_email',
					'feed_contact_url'
				]
			},
			'attributions.txt': {
				required: false,
				description: 'Dataset attributions',
				columns: [
					'attribution_id',
					'agency_id',
					'route_id',
					'trip_id',
					'organization_name',
					'is_producer',
					'is_operator',
					'is_authority',
					'attribution_url',
					'attribution_email',
					'attribution_phone'
				]
			}
		};

	const ROUTE_TYPES: Record<number, string> = {
		0: 'Tram/Light Rail',
		1: 'Subway/Metro',
		2: 'Rail',
		3: 'Bus',
		4: 'Ferry',
		5: 'Cable Tram',
		6: 'Aerial Lift',
		7: 'Funicular',
		11: 'Trolleybus',
		12: 'Monorail'
	};

	interface DbFeed {
		id: number;
		name: string;
		source_url: string | null;
		created_at: number;
	}

	let fileInputRef = $state<HTMLInputElement | null>(null);
	let dragOver = $state(false);

	let debouncedSearchQuery = $state('');

	let filteredSqlRows = $derived.by(() => {
		if (!gtfsState.sqlResult || !gtfsState.sqlResultSearch.trim()) {
			return gtfsState.sqlResult?.rows ?? [];
		}
		const searchLower = gtfsState.sqlResultSearch.toLowerCase();
		return gtfsState.sqlResult.rows.filter((row) =>
			Object.values(row).some((val) =>
				String(val ?? '')
					.toLowerCase()
					.includes(searchLower)
			)
		);
	});

	let sqlTotalPages = $derived(
		Math.ceil(filteredSqlRows.length / gtfsState.sqlResultPageSize) || 1
	);

	let paginatedSqlRows = $derived.by(() => {
		const start = (gtfsState.sqlResultPage - 1) * gtfsState.sqlResultPageSize;
		const end = start + gtfsState.sqlResultPageSize;
		return filteredSqlRows.slice(start, end);
	});

	$effect(() => {
		if (gtfsState.sqlResultSearch) {
			gtfsState.sqlResultPage = 1;
		}
	});

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	let savedUrls = $state<string[]>([]);

	let isDarkMode = $state(false);

	onMount(async () => {
		if (typeof localStorage !== 'undefined') {
			const saved = localStorage.getItem('gtfsStaticUrls');
			if (saved) {
				try {
					savedUrls = JSON.parse(saved);
				} catch {
					savedUrls = [];
				}
			}
			const savedUrl = localStorage.getItem('gtfsStaticLastUrl');
			if (savedUrl && !gtfsState.feedUrl) gtfsState.feedUrl = savedUrl;

			const savedFavorites = localStorage.getItem('gtfsSqlFavorites');
			if (savedFavorites) {
				try {
					gtfsState.favoriteQueries = JSON.parse(savedFavorites);
				} catch {
					gtfsState.favoriteQueries = [];
				}
			}

			const savedHistory = localStorage.getItem('gtfsSqlHistory');
			if (savedHistory) {
				try {
					gtfsState.queryHistory = JSON.parse(savedHistory);
				} catch {
					gtfsState.queryHistory = [];
				}
			}
		}

		isDarkMode =
			document.documentElement.classList.contains('dark') ||
			window.matchMedia('(prefers-color-scheme: dark)').matches;

		await loadExistingFeeds();
	});

	async function loadExistingFeeds() {
		try {
			const response = await fetch('/api/gtfs-static-db?action=feeds');
			const data = await response.json();
			if (data.feeds && data.feeds.length > 0) {
				const latestFeed = data.feeds[0] as DbFeed;
				await loadFeedFiles(latestFeed.id);
			}
		} catch (e) {
			console.warn('No existing GTFS feed found:', e);
		}
	}

	async function loadFeedFiles(feedId: number) {
		try {
			const response = await fetch(`/api/gtfs-static-db?action=files&feedId=${feedId}`);
			const data = await response.json();
			if (data.files) {
				gtfsState.gtfsFiles = data.files.map(
					(f: { id: number; filename: string; columns: string[]; row_count: number }) => ({
						id: f.id,
						name: f.filename,
						columns: f.columns,
						rowCount: f.row_count
					})
				);

				gtfsState.gtfsFiles.sort((a, b) => {
					const aRequired = GTFS_FILES[a.name]?.required ?? false;
					const bRequired = GTFS_FILES[b.name]?.required ?? false;
					if (aRequired !== bRequired) return bRequired ? 1 : -1;
					return a.name.localeCompare(b.name);
				});

				if (gtfsState.gtfsFiles.length > 0 && !gtfsState.selectedFileId) {
					await selectFile(gtfsState.gtfsFiles[0]);
				}
			}
		} catch (e) {
			console.error('Failed to load feed files:', e);
		}
	}

	async function queryData() {
		if (!gtfsState.selectedFileId) return;

		gtfsState.loadingData = true;
		try {
			const queryParams: Record<string, string> = {
				action: 'query',
				fileId: String(gtfsState.selectedFileId),
				page: String(gtfsState.currentPage),
				pageSize: String(gtfsState.pageSize)
			};

			if (debouncedSearchQuery) {
				queryParams.search = debouncedSearchQuery;
			}
			if (gtfsState.sortColumn) {
				queryParams.sortColumn = gtfsState.sortColumn;
				queryParams.sortDirection = gtfsState.sortDirection;
			}

			const params = new URLSearchParams(queryParams);

			const response = await fetch(`/api/gtfs-static-db?${params}`);
			const data = await response.json();

			gtfsState.rows = data.rows || [];
			gtfsState.totalRows = data.totalCount || 0;
			gtfsState.totalPages = data.totalPages || 1;
		} catch (e) {
			console.error('Failed to query data:', e);
			gtfsState.error = 'Failed to load data';
		} finally {
			gtfsState.loadingData = false;
			gtfsState.isSearching = false;
		}
	}

	$effect(() => {
		if (gtfsState.selectedFileId) {
			queryData();
		}
	});

	function saveUrl(url: string) {
		if (!url || savedUrls.includes(url)) return;
		savedUrls = [url, ...savedUrls.slice(0, 9)];
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('gtfsStaticUrls', JSON.stringify(savedUrls));
			localStorage.setItem('gtfsStaticLastUrl', url);
		}
	}

	function removeUrl(url: string) {
		savedUrls = savedUrls.filter((u) => u !== url);
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('gtfsStaticUrls', JSON.stringify(savedUrls));
		}
	}

	function yieldToUI(): Promise<void> {
		return new Promise((resolve) => {
			requestAnimationFrame(() => {
				setTimeout(resolve, 0);
			});
		});
	}

	async function processZipFile(file: File | Blob, sourceUrl?: string) {
		gtfsState.loading = true;
		gtfsState.error = null;
		gtfsState.gtfsFiles = [];
		gtfsState.selectedFileId = null;
		gtfsState.selectedFileName = null;
		gtfsState.rows = [];
		gtfsState.uploadProgressPercent = 5;
		gtfsState.currentProcessingFile = 'Starting...';
		gtfsState.uploadProgress = 'Initializing...';

		await yieldToUI();

		try {
			console.log('Processing zip file, size:', file.size);
			gtfsState.uploadProgress = 'Extracting ZIP file...';
			gtfsState.currentProcessingFile = 'Reading ZIP file...';
			gtfsState.uploadProgressPercent = 10;
			await yieldToUI();

			const JSZip = (await import('jszip')).default;
			const zip = await JSZip.loadAsync(file);

			const zipFileNames = Object.keys(zip.files);

			if (zipFileNames.length === 0) {
				throw new Error('The ZIP file appears to be empty');
			}

			const txtFiles = Object.entries(zip.files).filter(([filename, entry]) => {
				if (entry.dir) return false;
				const baseName = filename.split('/').pop() || filename;
				return baseName.endsWith('.txt');
			});

			const totalFiles = txtFiles.length;
			const rawFiles: Array<{ filename: string; content: string }> = [];

			for (let i = 0; i < txtFiles.length; i++) {
				const [filename, zipEntry] = txtFiles[i];
				const baseName = filename.split('/').pop() || filename;

				gtfsState.currentProcessingFile = baseName;
				gtfsState.uploadProgressPercent = Math.round(((i + 1) / totalFiles) * 40);
				gtfsState.uploadProgress = `Reading ${baseName} (${i + 1}/${totalFiles})...`;

				await yieldToUI();

				try {
					const content = await zipEntry.async('string');
					if (content.trim()) {
						rawFiles.push({
							filename: baseName,
							content
						});
					}
				} catch (readError) {
					console.warn(`Failed to read ${baseName}:`, readError);
				}
			}

			if (rawFiles.length === 0) {
				throw new Error('No valid GTFS files found in the ZIP');
			}

			gtfsState.uploadProgress = 'Uploading to server for processing...';
			gtfsState.uploadProgressPercent = 50;
			gtfsState.currentProcessingFile = 'Sending to server...';
			await yieldToUI();

			const response = await fetch('/api/gtfs-static-db', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'uploadRaw',
					name: sourceUrl || 'Uploaded GTFS',
					sourceUrl,
					files: rawFiles
				})
			});

			gtfsState.uploadProgressPercent = 90;
			await yieldToUI();

			const result = await response.json();

			if (!response.ok || result.error) {
				throw new Error(result.error || 'Failed to upload to database');
			}

			gtfsState.gtfsFiles = result.files.map(
				(f: { id: number; filename: string; columns: string[]; rowCount: number }) => ({
					id: f.id,
					name: f.filename,
					columns: f.columns,
					rowCount: f.rowCount
				})
			);

			gtfsState.gtfsFiles.sort((a, b) => {
				const aRequired = GTFS_FILES[a.name]?.required ?? false;
				const bRequired = GTFS_FILES[b.name]?.required ?? false;
				if (aRequired !== bRequired) return bRequired ? 1 : -1;
				return a.name.localeCompare(b.name);
			});

			gtfsState.uploadProgressPercent = 100;
			gtfsState.uploadProgress = 'Complete!';
			await yieldToUI();

			if (gtfsState.gtfsFiles.length > 0) {
				await selectFile(gtfsState.gtfsFiles[0]);
			}

			gtfsState.uploadProgress = '';
			gtfsState.uploadProgressPercent = 0;
			gtfsState.currentProcessingFile = '';
			gtfsState.showGtfsInput = false;
		} catch (e) {
			console.error('Error processing zip:', e);
			gtfsState.error = e instanceof Error ? e.message : 'Failed to process GTFS file';
			gtfsState.uploadProgress = '';
			gtfsState.uploadProgressPercent = 0;
			gtfsState.currentProcessingFile = '';
		} finally {
			gtfsState.loading = false;
		}
	}

	async function handleFileUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			await yieldToUI();
			await processZipFile(file);
		}
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
		const file = event.dataTransfer?.files?.[0];
		if (file) {
			await yieldToUI();
			await processZipFile(file);
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		dragOver = true;
	}

	function handleDragLeave() {
		dragOver = false;
	}

	async function fetchFromUrl() {
		if (!gtfsState.feedUrl.trim()) {
			gtfsState.error = 'Please enter a valid URL';
			return;
		}

		gtfsState.loading = true;
		gtfsState.error = null;
		gtfsState.gtfsFiles = [];
		gtfsState.selectedFileId = null;
		gtfsState.selectedFileName = null;
		gtfsState.rows = [];
		gtfsState.uploadProgressPercent = 5;
		gtfsState.currentProcessingFile = 'Starting...';
		gtfsState.uploadProgress = 'Fetching GTFS file...';

		await yieldToUI();

		try {
			gtfsState.uploadProgress = 'Fetching GTFS file...';
			gtfsState.uploadProgressPercent = 10;
			gtfsState.currentProcessingFile = 'Downloading from URL...';
			await yieldToUI();

			console.log('Fetching from URL:', gtfsState.feedUrl);

			const response = await fetch('/api/gtfs-static', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: gtfsState.feedUrl })
			});

			console.log('Response received');
			gtfsState.uploadProgressPercent = 30;
			await yieldToUI();

			const contentType = response.headers.get('content-type') || '';

			if (contentType.includes('application/json')) {
				const data = await response.json();
				throw new Error(data.error || 'Failed to fetch GTFS file');
			}

			if (!response.ok) {
				throw new Error(`Failed to fetch GTFS file: ${response.status} ${response.statusText}`);
			}

			gtfsState.uploadProgress = 'Downloading file...';
			gtfsState.uploadProgressPercent = 40;
			await yieldToUI();

			const blob = await response.blob();
			console.log('Blob received, size:', blob.size);

			if (blob.size === 0) {
				throw new Error('Received empty file from server');
			}

			await processZipFile(blob, gtfsState.feedUrl);
			saveUrl(gtfsState.feedUrl);
		} catch (e) {
			console.error('fetchFromUrl error:', e);
			gtfsState.error = e instanceof Error ? e.message : 'Failed to fetch GTFS file';
			gtfsState.loading = false;
			gtfsState.uploadProgress = '';
			gtfsState.uploadProgressPercent = 0;
			gtfsState.currentProcessingFile = '';
		}
	}

	function convertGtfsTimeFormatted(timeStr: string): string {
		if (!timeStr) return timeStr;

		const match = timeStr.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
		if (!match) return timeStr;

		let hours = parseInt(match[1], 10);
		const minutes = match[2];
		const seconds = match[3];

		const isNextDay = hours >= 24;
		if (isNextDay) {
			hours = hours - 24;
		}

		const period = hours >= 12 ? 'PM' : 'AM';
		const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

		const formatted = `${displayHours}:${minutes}:${seconds} ${period}`;
		return isNextDay ? `${formatted} (+1 day)` : formatted;
	}

	function convertGtfsDateFormatted(dateStr: string): string {
		if (!dateStr) return dateStr;

		const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/);
		if (!match) return dateStr;

		const year = match[1];
		const month = match[2];
		const day = match[3];

		const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function formatCellValue(
		column: string,
		value: string,
		doConvertTimes: boolean,
		doConvertDates: boolean
	): string {
		if (!value) return '';

		if (
			column.includes('time') ||
			column === 'arrival_time' ||
			column === 'departure_time' ||
			column === 'start_time' ||
			column === 'end_time'
		) {
			return doConvertTimes ? convertGtfsTimeFormatted(value) : value;
		}

		if (column.includes('date') || column === 'start_date' || column === 'end_date') {
			return doConvertDates ? convertGtfsDateFormatted(value) : value;
		}

		if (column === 'route_type') {
			const type = parseInt(value, 10);
			return ROUTE_TYPES[type] ? `${value} (${ROUTE_TYPES[type]})` : value;
		}

		if (
			['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(
				column
			)
		) {
			return value === '1' ? '✓ Yes' : '✗ No';
		}

		if (column === 'exception_type') {
			return value === '1' ? '1 (Added)' : value === '2' ? '2 (Removed)' : value;
		}

		if (column === 'location_type') {
			const types: Record<string, string> = {
				'0': 'Stop',
				'1': 'Station',
				'2': 'Entrance/Exit',
				'3': 'Generic Node',
				'4': 'Boarding Area'
			};
			return types[value] || value;
		}

		if (column === 'wheelchair_boarding' || column === 'wheelchair_accessible') {
			const types: Record<string, string> = {
				'0': 'Unknown',
				'1': 'Accessible',
				'2': 'Not Accessible'
			};
			return types[value] || value;
		}

		if (column === 'bikes_allowed') {
			const types: Record<string, string> = {
				'0': 'Unknown',
				'1': 'Allowed',
				'2': 'Not Allowed'
			};
			return types[value] || value;
		}

		if (column === 'direction_id') {
			return value === '0' ? '0 (Outbound)' : value === '1' ? '1 (Inbound)' : value;
		}

		if (column === 'pickup_type' || column === 'drop_off_type') {
			const types: Record<string, string> = {
				'0': 'Regular',
				'1': 'None',
				'2': 'Phone Agency',
				'3': 'Coordinate with Driver'
			};
			return types[value] || value;
		}

		if (column === 'transfer_type') {
			const types: Record<string, string> = {
				'0': 'Recommended',
				'1': 'Timed',
				'2': 'Min Time Required',
				'3': 'Not Possible'
			};
			return types[value] || value;
		}

		return value;
	}

	function getSelectedFileInfo(): GtfsFile | null {
		return gtfsState.gtfsFiles.find((f: GtfsFile) => f.id === gtfsState.selectedFileId) || null;
	}

	function toggleSort(column: string) {
		if (gtfsState.sortColumn === column) {
			gtfsState.sortDirection = gtfsState.sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			gtfsState.sortColumn = column;
			gtfsState.sortDirection = 'asc';
		}
		gtfsState.currentPage = 1;
		queryData();
	}

	function handleSearch() {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		gtfsState.isSearching = true;

		debounceTimer = setTimeout(() => {
			debouncedSearchQuery = gtfsState.searchQuery;
			gtfsState.currentPage = 1;
			queryData();
		}, 300);
	}

	async function selectFile(file: GtfsFile) {
		gtfsState.selectedFileId = file.id;
		gtfsState.selectedFileName = file.name;
		gtfsState.headers = file.columns;
		gtfsState.searchQuery = '';
		debouncedSearchQuery = '';
		gtfsState.sortColumn = null;
		gtfsState.sortDirection = 'asc';
		gtfsState.currentPage = 1;
		gtfsState.rows = [];
	}

	onDestroy(() => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
	});

	async function exportToCSV() {
		const file = getSelectedFileInfo();
		if (!file) return;

		try {
			const queryParams: Record<string, string> = {
				action: 'query',
				fileId: String(gtfsState.selectedFileId),
				page: '1',
				pageSize: '100000'
			};

			if (debouncedSearchQuery) {
				queryParams.search = debouncedSearchQuery;
			}

			const params = new URLSearchParams(queryParams);

			const response = await fetch(`/api/gtfs-static-db?${params}`);
			const data = await response.json();
			const rows = data.rows || [];

			const headers = file.columns.join(',');
			const csvRows = rows.map((row: Record<string, string>) =>
				file.columns
					.map((col) => {
						const val = row[col] || '';
						if (val.includes(',') || val.includes('"') || val.includes('\n')) {
							return `"${val.replace(/"/g, '""')}"`;
						}
						return val;
					})
					.join(',')
			);

			const csv = [headers, ...csvRows].join('\n');
			const blob = new Blob([csv], { type: 'text/csv' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${file.name.replace('.txt', '')}_export.csv`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (e) {
			console.error('Export failed:', e);
			gtfsState.error = 'Failed to export data';
		}
	}

	async function loadAvailableTables() {
		try {
			await fetch('/api/gtfs-static-db', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'recreateViews' })
			});

			const response = await fetch('/api/gtfs-static-db', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'tables' })
			});
			const data = await response.json();
			if (data.tables) {
				gtfsState.availableTables = data.tables;
			}
		} catch (e) {
			console.error('Failed to load tables:', e);
		}
	}

	async function executeSQL() {
		if (!gtfsState.sqlQuery.trim()) {
			gtfsState.sqlError = 'Please enter a SQL query';
			return;
		}

		gtfsState.sqlLoading = true;
		gtfsState.sqlError = null;
		gtfsState.sqlResult = null;
		gtfsState.sqlResultSearch = '';
		gtfsState.sqlResultPage = 1;

		try {
			const response = await fetch('/api/gtfs-static-db', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'sql',
					query: gtfsState.sqlQuery,
					limit: 10000
				})
			});

			const data = await response.json();

			if (!response.ok || data.error) {
				gtfsState.sqlError = data.error || 'Query execution failed';
				return;
			}

			gtfsState.sqlResult = data;

			if (!gtfsState.queryHistory.includes(gtfsState.sqlQuery)) {
				gtfsState.queryHistory = [gtfsState.sqlQuery, ...gtfsState.queryHistory.slice(0, 19)];
				if (typeof localStorage !== 'undefined') {
					localStorage.setItem('gtfsSqlHistory', JSON.stringify(gtfsState.queryHistory));
				}
			}
		} catch (e) {
			gtfsState.sqlError = e instanceof Error ? e.message : 'Failed to execute query';
		} finally {
			gtfsState.sqlLoading = false;
		}
	}

	function loadQueryFromHistory(query: string) {
		gtfsState.sqlQuery = query;
	}

	function clearQueryHistory() {
		gtfsState.queryHistory = [];
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem('gtfsSqlHistory');
		}
	}

	function insertTableName(tableName: string) {
		gtfsState.sqlQuery = `SELECT * FROM ${tableName} LIMIT 100`;
	}

	function addToFavorites() {
		if (!gtfsState.sqlQuery.trim()) return;
		gtfsState.showSaveFavoriteModal = true;
		gtfsState.newFavoriteName = '';
	}

	function saveFavorite() {
		if (!gtfsState.newFavoriteName.trim() || !gtfsState.sqlQuery.trim()) return;

		const existingIndex = gtfsState.favoriteQueries.findIndex(
			(f) => f.name === gtfsState.newFavoriteName.trim()
		);
		if (existingIndex >= 0) {
			gtfsState.favoriteQueries[existingIndex].query = gtfsState.sqlQuery;
		} else {
			gtfsState.favoriteQueries = [
				...gtfsState.favoriteQueries,
				{ name: gtfsState.newFavoriteName.trim(), query: gtfsState.sqlQuery }
			];
		}

		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('gtfsSqlFavorites', JSON.stringify(gtfsState.favoriteQueries));
		}

		gtfsState.showSaveFavoriteModal = false;
		gtfsState.newFavoriteName = '';
	}

	function removeFavorite(name: string) {
		gtfsState.favoriteQueries = gtfsState.favoriteQueries.filter((f) => f.name !== name);
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('gtfsSqlFavorites', JSON.stringify(gtfsState.favoriteQueries));
		}
	}

	function loadFavorite(query: string) {
		gtfsState.sqlQuery = query;
	}

	function exportSqlResultToCSV() {
		if (!gtfsState.sqlResult || gtfsState.sqlResult.rows.length === 0) return;

		const headers = gtfsState.sqlResult.columns.join(',');
		const csvRows = gtfsState.sqlResult.rows.map((row) =>
			gtfsState
				.sqlResult!.columns.map((col) => {
					const val = String(row[col] ?? '');
					if (val.includes(',') || val.includes('"') || val.includes('\n')) {
						return `"${val.replace(/"/g, '""')}"`;
					}
					return val;
				})
				.join(',')
		);

		const csv = [headers, ...csvRows].join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'sql_query_result.csv';
		a.click();
		URL.revokeObjectURL(url);
	}

	$effect(() => {
		if (
			gtfsState.activeTab === 'sql' &&
			gtfsState.gtfsFiles.length > 0 &&
			gtfsState.availableTables.length === 0
		) {
			loadAvailableTables();
		}
	});
</script>

<div
	class="flex min-h-screen flex-col bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100"
>
	{#if !gtfsState.showGtfsInput}
		<div class="flex items-center gap-3">
			<button
				onclick={() => {
					gtfsState.showGtfsInput = true;
				}}
				class="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 4v16m8-8H4"
					/>
				</svg>
				Load New GTFS Feed
			</button>
			<span class="text-sm text-gray-500 dark:text-gray-400">
				{gtfsState.gtfsFiles.length} files loaded
			</span>
		</div>
	{:else}
		<div
			class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
		>
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Load GTFS Static Feed</h2>
				{#if gtfsState.gtfsFiles.length > 0 && !gtfsState.loading}
					<button
						onclick={() => {
							gtfsState.showGtfsInput = false;
						}}
						class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
						title="Collapse this section"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 15l7-7 7 7"
							/>
						</svg>
						Collapse
					</button>
				{/if}
			</div>

			<div class="mb-4">
				<label
					for="gtfs-url-input"
					class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
				>
					Fetch from URL
				</label>
				<div class="flex gap-2">
					<div class="relative flex-1">
						<input
							id="gtfs-url-input"
							type="url"
							bind:value={gtfsState.feedUrl}
							placeholder="https://example.com/gtfs.zip"
							disabled={gtfsState.loading}
							class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
							onkeydown={(e) => e.key === 'Enter' && !gtfsState.loading && fetchFromUrl()}
						/>
						{#if savedUrls.length > 0}
							<div class="absolute top-1/2 right-2 -translate-y-1/2">
								<div class="group relative">
									<button
										class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
										title="Recent URLs"
									>
										<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
											/>
										</svg>
									</button>
									<div
										class="absolute top-full right-0 z-10 mt-1 hidden max-h-48 w-80 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg group-hover:block dark:border-gray-700 dark:bg-gray-800"
									>
										{#each savedUrls as url (url)}
											<div
												class="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
											>
												<button
													onclick={() => {
														gtfsState.feedUrl = url;
														fetchFromUrl();
													}}
													class="flex-1 truncate text-left text-sm text-gray-700 dark:text-gray-300"
												>
													{url}
												</button>
												<button
													onclick={() => removeUrl(url)}
													class="ml-2 text-gray-400 hover:text-red-500"
													title="Remove URL"
													aria-label="Remove URL from history"
												>
													<svg
														class="h-4 w-4"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M6 18L18 6M6 6l12 12"
														/>
													</svg>
												</button>
											</div>
										{/each}
									</div>
								</div>
							</div>
						{/if}
					</div>
					<button
						onclick={fetchFromUrl}
						disabled={gtfsState.loading}
						class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if gtfsState.loading}
							<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
									stroke-linecap="round"
								></circle>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
						{:else}
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
								/>
							</svg>
						{/if}
						Fetch
					</button>
				</div>
			</div>

			<div class="mb-4">
				<label
					for="gtfs-file-input"
					class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
				>
					Or upload a file
				</label>
				<div
					class="relative rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition-colors dark:border-gray-700 {gtfsState.loading
						? 'cursor-not-allowed opacity-50'
						: ''} {dragOver && !gtfsState.loading
						? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
						: 'hover:border-gray-400 dark:hover:border-gray-600'}"
					ondrop={gtfsState.loading ? undefined : handleDrop}
					ondragover={gtfsState.loading ? undefined : handleDragOver}
					ondragleave={gtfsState.loading ? undefined : handleDragLeave}
					role="button"
					tabindex={gtfsState.loading ? -1 : 0}
				>
					<input
						id="gtfs-file-input"
						type="file"
						accept=".zip"
						bind:this={fileInputRef}
						onchange={handleFileUpload}
						disabled={gtfsState.loading}
						class="absolute inset-0 cursor-pointer opacity-0 {gtfsState.loading
							? 'pointer-events-none'
							: ''}"
					/>
					<svg
						class="mx-auto h-10 w-10 text-gray-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
						/>
					</svg>
					<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
						<span class="font-medium text-blue-600 dark:text-blue-400">Click to upload</span> or drag
						and drop
					</p>
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-500">GTFS zip file</p>
				</div>
			</div>

			{#if gtfsState.error}
				<div
					class="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400"
				>
					<div class="flex items-center gap-2">
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						{gtfsState.error}
					</div>
				</div>
			{/if}

			{#if gtfsState.loading}
				<div
					class="flex flex-col items-center justify-center gap-4 rounded-lg bg-blue-50 p-6 dark:bg-blue-900/20"
				>
					<div class="flex items-center gap-3">
						<svg
							class="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						<span class="text-sm font-medium text-blue-700 dark:text-blue-300">
							{gtfsState.uploadProgress || 'Loading GTFS feed...'}
						</span>
					</div>

					{#if gtfsState.uploadProgressPercent > 0}
						<div class="w-full max-w-md">
							<div class="mb-1 flex justify-between text-xs text-gray-600 dark:text-gray-400">
								<span>{gtfsState.currentProcessingFile || 'Processing...'}</span>
								<span>{gtfsState.uploadProgressPercent}%</span>
							</div>
							<div class="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
								<div
									class="h-full rounded-full bg-blue-600 transition-all duration-300 ease-out dark:bg-blue-500"
									style="width: {gtfsState.uploadProgressPercent}%"
								></div>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	{#if gtfsState.gtfsFiles.length > 0}
		<div class="mb-4 flex border-b border-gray-200 dark:border-gray-700">
			<button
				onclick={() => {
					gtfsState.activeTab = 'browser';
				}}
				class="relative px-6 py-3 text-sm font-medium transition-colors {gtfsState.activeTab ===
				'browser'
					? 'text-blue-600 dark:text-blue-400'
					: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}"
			>
				<span class="flex items-center gap-2">
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 6h16M4 10h16M4 14h16M4 18h16"
						/>
					</svg>
					File Browser
				</span>
				{#if gtfsState.activeTab === 'browser'}
					<span class="absolute right-0 bottom-0 left-0 h-0.5 bg-blue-600 dark:bg-blue-400"></span>
				{/if}
			</button>
			<button
				onclick={() => {
					gtfsState.activeTab = 'sql';
				}}
				class="relative px-6 py-3 text-sm font-medium transition-colors {gtfsState.activeTab ===
				'sql'
					? 'text-blue-600 dark:text-blue-400'
					: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}"
			>
				<span class="flex items-center gap-2">
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
						/>
					</svg>
					SQL Query
				</span>
				{#if gtfsState.activeTab === 'sql'}
					<span class="absolute right-0 bottom-0 left-0 h-0.5 bg-blue-600 dark:bg-blue-400"></span>
				{/if}
			</button>
		</div>

		{#if gtfsState.activeTab === 'browser'}
			<div class="grid grid-cols-12 gap-6">
				<div class="col-span-3">
					<div
						class="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
					>
						<div class="border-b border-gray-200 p-4 dark:border-gray-700">
							<h3 class="text-sm font-semibold text-gray-900 dark:text-white">
								Files ({gtfsState.gtfsFiles.length})
							</h3>
						</div>
						<div class="max-h-150 overflow-auto p-2">
							{#each gtfsState.gtfsFiles as file (file.id)}
								{@const info = GTFS_FILES[file.name]}
								<button
									onclick={() => selectFile(file)}
									class="mb-1 w-full rounded-lg px-3 py-2 text-left transition-colors {gtfsState.selectedFileId ===
									file.id
										? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
										: 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'}"
								>
									<div class="flex items-center justify-between">
										<span class="text-sm font-medium">{file.name}</span>
										{#if info?.required}
											<span
												class="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400"
											>
												Required
											</span>
										{/if}
									</div>
									<div
										class="mt-0.5 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400"
									>
										<span>{info?.description || 'Custom file'}</span>
										<span>{file.rowCount.toLocaleString()} rows</span>
									</div>
								</button>
							{/each}
						</div>
					</div>

					<div
						class="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
					>
						<h3 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
							Feed Statistics
						</h3>
						<div class="space-y-2 text-sm">
							<div class="flex justify-between text-gray-600 dark:text-gray-400">
								<span>Total Files</span>
								<span class="font-medium text-gray-900 dark:text-white"
									>{gtfsState.gtfsFiles.length}</span
								>
							</div>
							<div class="flex justify-between text-gray-600 dark:text-gray-400">
								<span>Total Rows</span>
								<span class="font-medium text-gray-900 dark:text-white">
									{gtfsState.gtfsFiles.reduce((sum, f) => sum + f.rowCount, 0).toLocaleString()}
								</span>
							</div>
							{#if gtfsState.gtfsFiles.find((f) => f.name === 'routes.txt')}
								<div class="flex justify-between text-gray-600 dark:text-gray-400">
									<span>Routes</span>
									<span class="font-medium text-gray-900 dark:text-white">
										{gtfsState.gtfsFiles
											.find((f) => f.name === 'routes.txt')
											?.rowCount.toLocaleString()}
									</span>
								</div>
							{/if}
							{#if gtfsState.gtfsFiles.find((f) => f.name === 'stops.txt')}
								<div class="flex justify-between text-gray-600 dark:text-gray-400">
									<span>Stops</span>
									<span class="font-medium text-gray-900 dark:text-white">
										{gtfsState.gtfsFiles
											.find((f) => f.name === 'stops.txt')
											?.rowCount.toLocaleString()}
									</span>
								</div>
							{/if}
							{#if gtfsState.gtfsFiles.find((f) => f.name === 'trips.txt')}
								<div class="flex justify-between text-gray-600 dark:text-gray-400">
									<span>Trips</span>
									<span class="font-medium text-gray-900 dark:text-white">
										{gtfsState.gtfsFiles
											.find((f) => f.name === 'trips.txt')
											?.rowCount.toLocaleString()}
									</span>
								</div>
							{/if}
						</div>
					</div>
				</div>

				<div class="col-span-9">
					{#if gtfsState.selectedFileName}
						<div
							class="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
						>
							<div
								class="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 p-4 dark:border-gray-700"
							>
								<div class="flex items-center gap-4">
									<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
										{gtfsState.selectedFileName}
									</h3>
									<span class="text-sm text-gray-500 dark:text-gray-400">
										{gtfsState.rows.length.toLocaleString()} of {gtfsState.totalRows.toLocaleString()}
										rows
										{#if gtfsState.isSearching || gtfsState.loadingData}
											<span class="ml-2 text-blue-500">(loading...)</span>
										{/if}
									</span>
								</div>

								<div class="flex items-center gap-3">
									<div class="relative">
										<input
											type="text"
											bind:value={gtfsState.searchQuery}
											oninput={handleSearch}
											placeholder="Search..."
											class="w-64 rounded-lg border border-gray-300 bg-white py-2 pr-8 pl-9 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
										/>
										{#if gtfsState.isSearching || gtfsState.loadingData}
											<svg
												class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 animate-spin text-blue-500"
												fill="none"
												viewBox="0 0 24 24"
											>
												<circle
													class="opacity-25"
													cx="12"
													cy="12"
													r="10"
													stroke="currentColor"
													stroke-width="4"
												></circle>
												<path
													class="opacity-75"
													fill="currentColor"
													d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
												></path>
											</svg>
										{:else}
											<svg
												class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
												/>
											</svg>
										{/if}
										{#if gtfsState.searchQuery}
											<button
												onclick={() => {
													gtfsState.searchQuery = '';
													debouncedSearchQuery = '';
													gtfsState.currentPage = 1;
												}}
												class="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
												title="Clear search"
												aria-label="Clear search"
											>
												<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M6 18L18 6M6 6l12 12"
													/>
												</svg>
											</button>
										{/if}
									</div>

									<label
										class="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
									>
										<input
											type="checkbox"
											bind:checked={gtfsState.convertTimes}
											class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
										/>
										12h Time
									</label>

									<label
										class="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
									>
										<input
											type="checkbox"
											bind:checked={gtfsState.convertDates}
											class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
										/>
										Format Dates
									</label>

									<!-- Export -->
									<button
										onclick={exportToCSV}
										class="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
									>
										<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
											/>
										</svg>
										Export
									</button>
								</div>
							</div>

							<div class="overflow-x-auto">
								<table class="w-full text-left text-sm">
									<thead
										class="sticky top-0 bg-gray-50 text-xs text-gray-700 uppercase dark:bg-gray-800 dark:text-gray-400"
									>
										<tr>
											{#each gtfsState.headers as column (column)}
												<th class="px-4 py-3 whitespace-nowrap">
													<button
														onclick={() => toggleSort(column)}
														class="flex items-center gap-1 font-semibold hover:text-gray-900 dark:hover:text-white"
													>
														{column}
														{#if gtfsState.sortColumn === column}
															<svg
																class="h-4 w-4"
																fill="none"
																stroke="currentColor"
																viewBox="0 0 24 24"
															>
																{#if gtfsState.sortDirection === 'asc'}
																	<path
																		stroke-linecap="round"
																		stroke-linejoin="round"
																		stroke-width="2"
																		d="M5 15l7-7 7 7"
																	/>
																{:else}
																	<path
																		stroke-linecap="round"
																		stroke-linejoin="round"
																		stroke-width="2"
																		d="M19 9l-7 7-7-7"
																	/>
																{/if}
															</svg>
														{:else}
															<svg
																class="h-4 w-4 opacity-30"
																fill="none"
																stroke="currentColor"
																viewBox="0 0 24 24"
															>
																<path
																	stroke-linecap="round"
																	stroke-linejoin="round"
																	stroke-width="2"
																	d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
																/>
															</svg>
														{/if}
													</button>
												</th>
											{/each}
										</tr>
									</thead>
									<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
										{#each gtfsState.rows as row, idx (idx)}
											<tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
												{#each gtfsState.headers as column (column)}
													<td class="px-4 py-3 whitespace-nowrap text-gray-900 dark:text-gray-100">
														{formatCellValue(
															column,
															String(row[column] ?? ''),
															gtfsState.convertTimes,
															gtfsState.convertDates
														)}
													</td>
												{/each}
											</tr>
										{/each}
									</tbody>
								</table>
							</div>

							{#if gtfsState.rows.length === 0 && !gtfsState.loadingData}
								<div class="p-8 text-center text-gray-500 dark:text-gray-400">
									{#if gtfsState.searchQuery}
										No results found for "{gtfsState.searchQuery}"
									{:else}
										No data available
									{/if}
								</div>
							{/if}

							{#if gtfsState.loadingData}
								<div class="p-8 text-center text-gray-500 dark:text-gray-400">
									<svg
										class="mx-auto h-8 w-8 animate-spin text-blue-500"
										fill="none"
										viewBox="0 0 24 24"
									>
										<circle
											class="opacity-25"
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											stroke-width="4"
										></circle>
										<path
											class="opacity-75"
											fill="currentColor"
											d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
										></path>
									</svg>
									<p class="mt-2">Loading data...</p>
								</div>
							{/if}

							{#if gtfsState.totalPages > 1}
								<div
									class="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700"
								>
									<div class="flex items-center gap-2">
										<span class="text-sm text-gray-600 dark:text-gray-400">Rows per page:</span>
										<select
											bind:value={gtfsState.pageSize}
											onchange={() => {
												gtfsState.currentPage = 1;
											}}
											class="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
										>
											<option value={25}>25</option>
											<option value={50}>50</option>
											<option value={100}>100</option>
											<option value={250}>250</option>
										</select>
									</div>

									<div class="flex items-center gap-2">
										<span class="text-sm text-gray-600 dark:text-gray-400">
											Page {gtfsState.currentPage} of {gtfsState.totalPages}
										</span>
										<div class="flex gap-1">
											<button
												onclick={() => {
													gtfsState.currentPage = 1;
												}}
												disabled={gtfsState.currentPage === 1}
												class="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-700"
												title="First page"
												aria-label="Go to first page"
											>
												<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
													/>
												</svg>
											</button>
											<button
												onclick={() => {
													gtfsState.currentPage = Math.max(1, gtfsState.currentPage - 1);
												}}
												disabled={gtfsState.currentPage === 1}
												class="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-700"
												title="Previous page"
												aria-label="Go to previous page"
											>
												<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M15 19l-7-7 7-7"
													/>
												</svg>
											</button>
											<button
												onclick={() => {
													gtfsState.currentPage = Math.min(
														gtfsState.totalPages,
														gtfsState.currentPage + 1
													);
												}}
												disabled={gtfsState.currentPage === gtfsState.totalPages}
												class="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-700"
												title="Next page"
												aria-label="Go to next page"
											>
												<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M9 5l7 7-7 7"
													/>
												</svg>
											</button>
											<button
												onclick={() => {
													gtfsState.currentPage = gtfsState.totalPages;
												}}
												disabled={gtfsState.currentPage === gtfsState.totalPages}
												class="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-700"
												title="Last page"
												aria-label="Go to last page"
											>
												<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M13 5l7 7-7 7M5 5l7 7-7 7"
													/>
												</svg>
											</button>
										</div>
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/if}

		{#if gtfsState.activeTab === 'sql'}
			<div class="grid grid-cols-12 gap-6">
				<div class="col-span-3">
					<div
						class="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
					>
						<div class="border-b border-gray-200 p-4 dark:border-gray-700">
							<h3 class="text-sm font-semibold text-gray-900 dark:text-white">Available Tables</h3>
						</div>
						<div class="max-h-100 overflow-auto p-2">
							{#if gtfsState.availableTables.length === 0}
								<p class="p-3 text-sm text-gray-500 dark:text-gray-400">Loading tables...</p>
							{:else}
								{#each gtfsState.availableTables as table (table.name)}
									<button
										onclick={() => insertTableName(table.name)}
										class="mb-1 w-full rounded-lg px-3 py-2 text-left text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
									>
										<div class="flex items-center justify-between">
											<span class="text-sm font-medium">{table.name}</span>
											<span class="text-xs text-gray-400">{table.rowCount.toLocaleString()}</span>
										</div>
										<div class="mt-1 truncate text-xs text-gray-400 dark:text-gray-500">
											{table.columns.slice(0, 4).join(', ')}{table.columns.length > 4 ? '...' : ''}
										</div>
									</button>
								{/each}
							{/if}
						</div>
					</div>

					<div
						class="mt-4 rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
					>
						<div
							class="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700"
						>
							<h3 class="text-sm font-semibold text-gray-900 dark:text-white">Query History</h3>
							{#if gtfsState.queryHistory.length > 0}
								<button
									onclick={clearQueryHistory}
									class="text-xs text-gray-400 hover:text-red-500"
									title="Clear history"
								>
									Clear
								</button>
							{/if}
						</div>
						<div class="max-h-50 overflow-auto p-2">
							{#if gtfsState.queryHistory.length === 0}
								<p class="p-3 text-sm text-gray-500 dark:text-gray-400">No queries yet</p>
							{:else}
								{#each gtfsState.queryHistory as query (query)}
									<button
										onclick={() => loadQueryFromHistory(query)}
										class="mb-1 w-full truncate rounded-lg px-3 py-2 text-left font-mono text-xs text-gray-600 transition-colors hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
									>
										{query}
									</button>
								{/each}
							{/if}
						</div>
					</div>

					<div
						class="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
					>
						<div class="mb-3 flex items-center justify-between">
							<h3 class="text-sm font-semibold text-gray-900 dark:text-white">
								<span class="flex items-center gap-1.5">
									<svg class="h-4 w-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
										<path
											d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
										/>
									</svg>
									Favorites
								</span>
							</h3>
						</div>
						<div class="max-h-75 space-y-1 overflow-auto">
							{#if gtfsState.favoriteQueries.length === 0}
								<p class="py-2 text-xs text-gray-400 dark:text-gray-500">
									No favorites yet. Click the star icon to save a query.
								</p>
							{:else}
								{#each gtfsState.favoriteQueries as fav (fav.name)}
									<div
										class="group flex items-center gap-1 rounded px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
									>
										<button
											onclick={() => loadFavorite(fav.query)}
											class="flex-1 truncate text-left text-xs text-gray-600 dark:text-gray-400"
											title={fav.query}
										>
											{fav.name}
										</button>
										<button
											onclick={() => removeFavorite(fav.name)}
											class="p-1 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
											title="Remove from favorites"
										>
											<svg
												class="h-3.5 w-3.5"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M6 18L18 6M6 6l12 12"
												/>
											</svg>
										</button>
									</div>
								{/each}
							{/if}
						</div>
					</div>
				</div>

				<div class="col-span-9">
					<div
						class="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
					>
						<div class="border-b border-gray-200 p-4 dark:border-gray-700">
							<div class="mb-3 flex items-center justify-between">
								<h3 class="text-lg font-semibold text-gray-900 dark:text-white">SQL Query</h3>
								<div class="flex items-center gap-2">
									<span class="text-xs text-gray-400">Only SELECT queries allowed</span>
								</div>
							</div>
							<div class="relative">
								<SqlEditor
									bind:value={gtfsState.sqlQuery}
									onchange={(v) => {
										gtfsState.sqlQuery = v;
									}}
									onrun={executeSQL}
									tables={gtfsState.availableTables.map((t) => ({
										name: t.name,
										columns: t.columns
									}))}
									isDark={isDarkMode}
								/>
								<div class="mt-3 flex items-center justify-between">
									<span class="text-xs text-gray-400"
										>Press Ctrl+Enter to run • Type for autocomplete</span
									>
									<div class="flex items-center gap-2">
										<button
											onclick={addToFavorites}
											disabled={!gtfsState.sqlQuery.trim()}
											class="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
											title="Save to favorites"
										>
											<svg
												class="h-4 w-4 text-yellow-500"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
												/>
											</svg>
											Favorite
										</button>
										<button
											onclick={executeSQL}
											disabled={gtfsState.sqlLoading || !gtfsState.sqlQuery.trim()}
											class="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
										>
											{#if gtfsState.sqlLoading}
												<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
													<circle
														class="opacity-25"
														cx="12"
														cy="12"
														r="10"
														stroke="currentColor"
														stroke-width="4"
													></circle>
													<path
														class="opacity-75"
														fill="currentColor"
														d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
													></path>
												</svg>
											{:else}
												<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
													/>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
													/>
												</svg>
											{/if}
											Run Query
										</button>
									</div>
								</div>
							</div>
						</div>

						{#if gtfsState.showSaveFavoriteModal}
							<div
								class="border-b border-gray-200 bg-yellow-50 p-4 dark:border-gray-700 dark:bg-yellow-900/20"
							>
								<div class="flex items-center gap-3">
									<input
										type="text"
										bind:value={gtfsState.newFavoriteName}
										placeholder="Enter a name for this query..."
										class="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
										onkeydown={(e) => {
											if (e.key === 'Enter') saveFavorite();
											if (e.key === 'Escape') gtfsState.showSaveFavoriteModal = false;
										}}
									/>
									<button
										onclick={saveFavorite}
										disabled={!gtfsState.newFavoriteName.trim()}
										class="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-yellow-600 disabled:opacity-50"
									>
										Save
									</button>
									<button
										onclick={() => {
											gtfsState.showSaveFavoriteModal = false;
										}}
										class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
									>
										Cancel
									</button>
								</div>
							</div>
						{/if}

						{#if gtfsState.sqlError}
							<div
								class="border-b border-gray-200 bg-red-50 p-4 dark:border-gray-700 dark:bg-red-900/20"
							>
								<div class="flex items-start gap-2 text-red-700 dark:text-red-400">
									<svg
										class="mt-0.5 h-5 w-5 shrink-0"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
									<div>
										<p class="font-medium">Query Error</p>
										<p class="mt-1 text-sm">{gtfsState.sqlError}</p>
									</div>
								</div>
							</div>
						{/if}

						{#if gtfsState.sqlResult}
							<div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
								<div class="flex flex-wrap items-center justify-between gap-3">
									<div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
										<span
											><strong>{filteredSqlRows.length.toLocaleString()}</strong
											>{gtfsState.sqlResultSearch
												? ` of ${(gtfsState.sqlResult.rowCount ?? 0).toLocaleString()}`
												: ''} rows</span
										>
										<span class="text-gray-400">|</span>
										<span>{gtfsState.sqlResult.executionTime} ms</span>
										{#if gtfsState.sqlResult.truncated}
											<span
												class="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
											>
												Results truncated to 10,000 rows
											</span>
										{/if}
									</div>
									<div class="flex items-center gap-2">
										<div class="relative">
											<input
												type="text"
												bind:value={gtfsState.sqlResultSearch}
												placeholder="Search results..."
												class="w-48 rounded-lg border border-gray-300 bg-white py-1.5 pr-8 pl-8 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
											/>
											<svg
												class="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
												/>
											</svg>
											{#if gtfsState.sqlResultSearch}
												<button
													onclick={() => {
														gtfsState.sqlResultSearch = '';
													}}
													class="absolute top-1/2 right-2.5 -translate-y-1/2 text-gray-400 hover:text-gray-600"
													title="Clear search"
												>
													<svg
														class="h-4 w-4"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M6 18L18 6M6 6l12 12"
														/>
													</svg>
												</button>
											{/if}
										</div>
										<button
											onclick={exportSqlResultToCSV}
											disabled={gtfsState.sqlResult.rows.length === 0}
											class="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
										>
											<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
												/>
											</svg>
											Export CSV
										</button>
									</div>
								</div>
							</div>

							<div class="max-h-125 overflow-auto">
								<table class="w-full text-left text-sm">
									<thead
										class="sticky top-0 bg-gray-50 text-xs text-gray-700 uppercase dark:bg-gray-800 dark:text-gray-400"
									>
										<tr>
											{#each gtfsState.sqlResult.columns as column (column)}
												<th class="px-4 py-3 font-semibold whitespace-nowrap">{column}</th>
											{/each}
										</tr>
									</thead>
									<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
										{#each paginatedSqlRows as row, i (i)}
											<tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
												{#each gtfsState.sqlResult.columns as column (column)}
													<td class="px-4 py-3 whitespace-nowrap text-gray-900 dark:text-gray-100">
														{row[column] ?? ''}
													</td>
												{/each}
											</tr>
										{/each}
									</tbody>
								</table>
							</div>

							{#if filteredSqlRows.length === 0}
								<div class="p-8 text-center text-gray-500 dark:text-gray-400">
									{#if gtfsState.sqlResultSearch}
										No results match "{gtfsState.sqlResultSearch}"
									{:else}
										Query returned no results
									{/if}
								</div>
							{:else if sqlTotalPages > 1}
								<div
									class="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700"
								>
									<div class="flex items-center gap-2">
										<span class="text-sm text-gray-600 dark:text-gray-400">Rows per page:</span>
										<select
											bind:value={gtfsState.sqlResultPageSize}
											onchange={() => {
												gtfsState.sqlResultPage = 1;
											}}
											class="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
										>
											<option value={25}>25</option>
											<option value={50}>50</option>
											<option value={100}>100</option>
											<option value={250}>250</option>
										</select>
									</div>

									<div class="flex items-center gap-2">
										<span class="text-sm text-gray-600 dark:text-gray-400">
											Page {gtfsState.sqlResultPage} of {sqlTotalPages}
											<span class="text-gray-400"
												>({filteredSqlRows.length.toLocaleString()} rows)</span
											>
										</span>
										<div class="flex gap-1">
											<button
												onclick={() => {
													gtfsState.sqlResultPage = 1;
												}}
												disabled={gtfsState.sqlResultPage === 1}
												class="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-700"
												title="First page"
											>
												<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
													/>
												</svg>
											</button>
											<button
												onclick={() => {
													gtfsState.sqlResultPage = Math.max(1, gtfsState.sqlResultPage - 1);
												}}
												disabled={gtfsState.sqlResultPage === 1}
												class="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-700"
												title="Previous page"
											>
												<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M15 19l-7-7 7-7"
													/>
												</svg>
											</button>
											<button
												onclick={() => {
													gtfsState.sqlResultPage = Math.min(
														sqlTotalPages,
														gtfsState.sqlResultPage + 1
													);
												}}
												disabled={gtfsState.sqlResultPage === sqlTotalPages}
												class="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-700"
												title="Next page"
											>
												<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M9 5l7 7-7 7"
													/>
												</svg>
											</button>
											<button
												onclick={() => {
													gtfsState.sqlResultPage = sqlTotalPages;
												}}
												disabled={gtfsState.sqlResultPage === sqlTotalPages}
												class="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-700"
												title="Last page"
											>
												<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M13 5l7 7-7 7M5 5l7 7-7 7"
													/>
												</svg>
											</button>
										</div>
									</div>
								</div>
							{/if}
						{:else if !gtfsState.sqlError && !gtfsState.sqlLoading}
							<div class="p-12 text-center text-gray-400 dark:text-gray-500">
								<svg
									class="mx-auto mb-3 h-12 w-12"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="1.5"
										d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
									/>
								</svg>
								<p>Write a SQL query and click "Run Query" to see results</p>
								<p class="mt-1 text-sm">Click on a table name to insert a SELECT query</p>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>
