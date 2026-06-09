<script lang="ts">
	import ProtobufViewer from '$lib/components/ProtobufViewer.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { logState } from '$lib/logState.svelte';
	import { protobufState as pbState, type GtfsRtFeedConfig } from '$lib/panelState.svelte';

	function handleKeyDown(e: KeyboardEvent) {
		if (e.ctrlKey && e.key === 'Enter' && !pbState.loading) {
			e.preventDefault();
			if (pbState.configFeeds.length > 0) fetchAllConfigFeeds();
			else fetchAllFeedsManual();
		}
	}

	function saveUrlToHistory(url: string, history: string[]): string[] {
		if (!url || history.includes(url)) return history;
		return [url, ...history.filter((u) => u !== url)].slice(0, 5);
	}

	function saveUrlHistories() {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('tripUpdatesUrlHistory', JSON.stringify(pbState.tripUpdatesUrlHistory));
			localStorage.setItem(
				'vehiclePositionsUrlHistory',
				JSON.stringify(pbState.vehiclePositionsUrlHistory)
			);
			localStorage.setItem(
				'serviceAlertsUrlHistory',
				JSON.stringify(pbState.serviceAlertsUrlHistory)
			);
		}
	}

	function handleConfigUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		readConfigFile(file);
	}

	function handleConfigDrop(event: DragEvent) {
		event.preventDefault();
		const file = event.dataTransfer?.files?.[0];
		if (!file) return;
		readConfigFile(file);
	}

	function readConfigFile(file: File) {
		pbState.configError = '';
		if (!file.name.endsWith('.json')) {
			pbState.configError = 'Please upload a .json file';
			return;
		}
		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const content = e.target?.result as string;
				const parsed = JSON.parse(content);

				let feeds: GtfsRtFeedConfig[] = [];

				if (Array.isArray(parsed)) {
					feeds = parsed;
				} else if (parsed['gtfs-rt-feeds'] && Array.isArray(parsed['gtfs-rt-feeds'])) {
					feeds = parsed['gtfs-rt-feeds'];

					if (parsed['gtfs-static-feed']?.url) {
						localStorage.setItem('gtfsStaticLastUrl', parsed['gtfs-static-feed'].url);
					}
				} else {
					pbState.configError =
						'Config must contain a "gtfs-rt-feeds" array or be an array of feeds';
					return;
				}

				if (feeds.length === 0) {
					pbState.configError = 'No feeds found in config';
					return;
				}

				feeds = feeds.map((f, i) => ({ ...f, id: f.id || `feed-${i}` }));
				pbState.configFeeds = feeds;
				pbState.configFileName = file.name;
				pbState.feedData = null;
				selectAllFeeds();
				switchToFeed(feeds[0].id!);
			} catch {
				pbState.configError = 'Invalid JSON file';
			}
		};
		reader.readAsText(file);
	}

	let configDragOver = $state(false);

	function clearConfig() {
		pbState.configFeeds = [];
		pbState.configFileName = '';
		pbState.configError = '';
		pbState.selectedFeedIds = {};
		pbState.activeDisplayFeedId = '';
		pbState.feedResults = {};
		pbState.feedTiming = {};
		pbState.loadingFeeds = {};
		pbState.feedData = null;
		pbState.currentFetchUrls = { tripUpdates: '', vehiclePositions: '', alerts: '' };
	}

	function toggleFeedSelection(feedId: string) {
		pbState.selectedFeedIds = {
			...pbState.selectedFeedIds,
			[feedId]: !pbState.selectedFeedIds[feedId]
		};
	}

	function selectAllFeeds() {
		const all: Record<string, boolean> = {};
		for (const feed of pbState.configFeeds) {
			all[feed.id!] = true;
		}
		pbState.selectedFeedIds = all;
	}

	function deselectAllFeeds() {
		pbState.selectedFeedIds = {};
	}

	function switchToFeed(feedId: string) {
		pbState.activeDisplayFeedId = feedId;
		const data = pbState.feedResults[feedId];
		if (data) {
			pbState.feedData = data;
			const feed = pbState.configFeeds.find((f) => f.id === feedId);
			if (feed) {
				pbState.currentFetchUrls = {
					tripUpdates: feed['trip-updates-url'] || '',
					vehiclePositions: feed['vehicle-positions-url'] || '',
					alerts: feed['service-alerts-url'] || ''
				};
			}
		} else {
			pbState.feedData = null;
		}
	}

	async function fetchSingleFeedUrl(
		url: string,
		headers: { key: string; value: string }[],
		sessionId?: string
	): Promise<{
		tripUpdates: unknown[];
		vehiclePositions: unknown[];
		alerts: unknown[];
		header: unknown;
		totals?: { tripUpdates: number; vehiclePositions: number; alerts: number };
		limited?: { tripUpdates: boolean; vehiclePositions: boolean; alerts: boolean };
		pagination?: {
			limit: number;
			offset: { tripUpdates: number; vehiclePositions: number; alerts: number };
			hasMore: { tripUpdates: boolean; vehiclePositions: boolean; alerts: boolean };
		};
	} | null> {
		if (!url) return null;
		const response = await fetch('/api/protobuf', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				url,
				headers: headers.filter((h) => h.key && h.value),
				sessionId
			})
		});
		const data = await response.json();
		if (data.error) throw new Error(data.error);
		return data;
	}

	async function fetchAllConfigFeeds() {
		const selectedIds = Object.entries(pbState.selectedFeedIds)
			.filter(([, v]) => v)
			.map(([k]) => k);
		if (selectedIds.length === 0) {
			pbState.error = 'Please select at least one feed';
			return;
		}

		pbState.loading = true;
		pbState.error = undefined;
		pbState.lastFetchTime = null;
		const sessionId = crypto.randomUUID();

		const loadingUpdate: Record<string, boolean> = {};
		for (const id of selectedIds) loadingUpdate[id] = true;
		pbState.loadingFeeds = { ...pbState.loadingFeeds, ...loadingUpdate };

		try {
			for (const feedId of selectedIds) {
				const feed = pbState.configFeeds.find((f) => f.id === feedId);
				if (!feed) {
					pbState.loadingFeeds = { ...pbState.loadingFeeds, [feedId]: false };
					continue;
				}

				const headers = buildFeedHeaders(feed);
				const start = performance.now();
				const timing = {
					tripUpdates: 0,
					vehiclePositions: 0,
					serviceAlerts: 0,
					total: 0,
					errors: [] as string[]
				};

				const urlTrio = [
					{ type: 'tripUpdates' as const, url: feed['trip-updates-url'] },
					{ type: 'vehiclePositions' as const, url: feed['vehicle-positions-url'] },
					{ type: 'serviceAlerts' as const, url: feed['service-alerts-url'] }
				];

				const urlResults = await Promise.allSettled(
					urlTrio.map(async ({ type, url }) => {
						if (!url) return { type, data: null };
						const s = performance.now();
						const result = await fetchSingleFeedUrl(url, headers, sessionId);
						const elapsed = performance.now() - s;
						if (type === 'tripUpdates') timing.tripUpdates = elapsed;
						else if (type === 'vehiclePositions') timing.vehiclePositions = elapsed;
						else timing.serviceAlerts = elapsed;
						return { type, data: result };
					})
				);

				timing.total = performance.now() - start;

				let allTripUpdates: unknown[] = [];
				let allVehiclePositions: unknown[] = [];
				let allAlerts: unknown[] = [];
				let header: unknown = null;

				for (const result of urlResults) {
					if (result.status === 'fulfilled') {
						const data = result.value.data;
						if (data) {
							if (data.tripUpdates) allTripUpdates = [...allTripUpdates, ...data.tripUpdates];
							if (data.vehiclePositions)
								allVehiclePositions = [...allVehiclePositions, ...data.vehiclePositions];
							if (data.alerts) allAlerts = [...allAlerts, ...data.alerts];
							if (data.header) header = data.header;
						}
					} else {
						timing.errors.push(result.reason?.message || 'Unknown error');
					}
				}

				const mergedLimited = { tripUpdates: false, vehiclePositions: false, alerts: false };
				const mergedHasMore = { tripUpdates: false, vehiclePositions: false, alerts: false };
				for (const r of urlResults) {
					if (r.status === 'fulfilled' && r.value.data) {
						const d = r.value.data;
						if (d.limited) {
							if (d.limited.tripUpdates) mergedLimited.tripUpdates = true;
							if (d.limited.vehiclePositions) mergedLimited.vehiclePositions = true;
							if (d.limited.alerts) mergedLimited.alerts = true;
						}
						if (d.pagination?.hasMore) {
							if (d.pagination.hasMore.tripUpdates) mergedHasMore.tripUpdates = true;
							if (d.pagination.hasMore.vehiclePositions) mergedHasMore.vehiclePositions = true;
							if (d.pagination.hasMore.alerts) mergedHasMore.alerts = true;
						}
					}
				}

				const totals = {
					tripUpdates: allTripUpdates.length,
					vehiclePositions: allVehiclePositions.length,
					alerts: allAlerts.length
				};

				pbState.feedResults = {
					...pbState.feedResults,
					[feedId]: {
						header,
						tripUpdates: allTripUpdates,
						vehiclePositions: allVehiclePositions,
						alerts: allAlerts,
						entityCount: allTripUpdates.length + allVehiclePositions.length + allAlerts.length,
						totals,
						limited: mergedLimited
					}
				};

				pbState.feedTiming = {
					...pbState.feedTiming,
					[feedId]: timing
				};

				pbState.loadingFeeds = { ...pbState.loadingFeeds, [feedId]: false };
				pbState.paginationState.hasMore = mergedHasMore;

				if (!pbState.activeDisplayFeedId || !pbState.feedResults[pbState.activeDisplayFeedId]) {
					switchToFeed(feedId);
				}

				if (pbState.loggingEnabled && pbState.feedResults[feedId]) {
					const d = pbState.feedResults[feedId]!;
					await fetch('/api/gtfs-rt', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							timestamp: new Date().toISOString(),
							data: {
								header: d.header,
								tripUpdates: d.tripUpdates,
								vehiclePositions: d.vehiclePositions,
								alerts: d.alerts,
								entityCount: d.entityCount,
								totals: d.totals,
								limited: d.limited
							}
						})
					});
					logState.triggerUpdate();
				}

				await new Promise((r) => setTimeout(r, 0));
			}

			pbState.lastFetchTime = new Date();
		} catch (e) {
			pbState.error = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			pbState.loading = false;
		}
	}

	async function fetchSingleConfigFeed(feedId: string) {
		const feed = pbState.configFeeds.find((f) => f.id === feedId);
		if (!feed) return;

		pbState.loadingFeeds = { ...pbState.loadingFeeds, [feedId]: true };
		const sessionId = crypto.randomUUID();
		const headers = buildFeedHeaders(feed);
		const start = performance.now();
		const timing = {
			tripUpdates: 0,
			vehiclePositions: 0,
			serviceAlerts: 0,
			total: 0,
			errors: [] as string[]
		};

		const urlTrio = [
			{ type: 'tripUpdates' as const, url: feed['trip-updates-url'] },
			{ type: 'vehiclePositions' as const, url: feed['vehicle-positions-url'] },
			{ type: 'serviceAlerts' as const, url: feed['service-alerts-url'] }
		];

		const urlResults = await Promise.allSettled(
			urlTrio.map(async ({ type, url }) => {
				if (!url) return { type, data: null };
				const s = performance.now();
				const result = await fetchSingleFeedUrl(url, headers, sessionId);
				const elapsed = performance.now() - s;
				if (type === 'tripUpdates') timing.tripUpdates = elapsed;
				else if (type === 'vehiclePositions') timing.vehiclePositions = elapsed;
				else timing.serviceAlerts = elapsed;
				return { type, data: result };
			})
		);

		timing.total = performance.now() - start;

		let allTripUpdates: unknown[] = [];
		let allVehiclePositions: unknown[] = [];
		let allAlerts: unknown[] = [];
		let header: unknown = null;

		for (const result of urlResults) {
			if (result.status === 'fulfilled') {
				const data = result.value.data;
				if (data) {
					if (data.tripUpdates) allTripUpdates = [...allTripUpdates, ...data.tripUpdates];
					if (data.vehiclePositions)
						allVehiclePositions = [...allVehiclePositions, ...data.vehiclePositions];
					if (data.alerts) allAlerts = [...allAlerts, ...data.alerts];
					if (data.header) header = data.header;
				}
			} else {
				timing.errors.push(result.reason?.message || 'Unknown error');
			}
		}

		const mergedLimited = { tripUpdates: false, vehiclePositions: false, alerts: false };
		const mergedHasMore = { tripUpdates: false, vehiclePositions: false, alerts: false };
		for (const r of urlResults) {
			if (r.status === 'fulfilled' && r.value.data) {
				const d = r.value.data;
				if (d.limited) {
					if (d.limited.tripUpdates) mergedLimited.tripUpdates = true;
					if (d.limited.vehiclePositions) mergedLimited.vehiclePositions = true;
					if (d.limited.alerts) mergedLimited.alerts = true;
				}
				if (d.pagination?.hasMore) {
					if (d.pagination.hasMore.tripUpdates) mergedHasMore.tripUpdates = true;
					if (d.pagination.hasMore.vehiclePositions) mergedHasMore.vehiclePositions = true;
					if (d.pagination.hasMore.alerts) mergedHasMore.alerts = true;
				}
			}
		}

		pbState.feedResults = {
			...pbState.feedResults,
			[feedId]: {
				header,
				tripUpdates: allTripUpdates,
				vehiclePositions: allVehiclePositions,
				alerts: allAlerts,
				entityCount: allTripUpdates.length + allVehiclePositions.length + allAlerts.length,
				totals: {
					tripUpdates: allTripUpdates.length,
					vehiclePositions: allVehiclePositions.length,
					alerts: allAlerts.length
				},
				limited: mergedLimited
			}
		};

		pbState.feedTiming = { ...pbState.feedTiming, [feedId]: timing };
		pbState.loadingFeeds = { ...pbState.loadingFeeds, [feedId]: false };
		pbState.paginationState.hasMore = mergedHasMore;

		if (pbState.activeDisplayFeedId === feedId) {
			switchToFeed(feedId);
		}

		pbState.lastFetchTime = new Date();

		if (pbState.loggingEnabled && pbState.feedResults[feedId]) {
			const d = pbState.feedResults[feedId]!;
			await fetch('/api/gtfs-rt', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					timestamp: new Date().toISOString(),
					data: {
						header: d.header,
						tripUpdates: d.tripUpdates,
						vehiclePositions: d.vehiclePositions,
						alerts: d.alerts,
						entityCount: d.entityCount,
						totals: d.totals,
						limited: d.limited
					}
				})
			});
			logState.triggerUpdate();
		}
	}

	function buildFeedHeaders(feed: GtfsRtFeedConfig): { key: string; value: string }[] {
		const headerMap: Record<string, string> = { ...(feed.headers || {}) };
		if (feed['realtime-auth-header-name'] && feed['realtime-auth-header-value']) {
			headerMap[feed['realtime-auth-header-name']] = feed['realtime-auth-header-value'];
		}
		return Object.entries(headerMap).map(([key, value]) => ({ key, value: String(value) }));
	}
	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);

		if (typeof localStorage !== 'undefined') {
			const hasState =
				pbState.tripUpdatesUrl || pbState.vehiclePositionsUrl || pbState.serviceAlertsUrl;

			if (!hasState) {
				if (localStorage.tripUpdatesUrl) pbState.tripUpdatesUrl = localStorage.tripUpdatesUrl;
				if (localStorage.vehiclePositionsUrl)
					pbState.vehiclePositionsUrl = localStorage.vehiclePositionsUrl;
				if (localStorage.serviceAlertsUrl) pbState.serviceAlertsUrl = localStorage.serviceAlertsUrl;

				if (localStorage.protobufHeaders) {
					try {
						pbState.headers = JSON.parse(localStorage.protobufHeaders);
					} catch {
						pbState.headers = [{ key: '', value: '' }];
					}
				}
				if (localStorage.gtfsRtLoggingEnabled !== undefined) {
					pbState.loggingEnabled = localStorage.gtfsRtLoggingEnabled === 'true';
				}
			}

			try {
				const tuHistory = localStorage.getItem('tripUpdatesUrlHistory');
				if (tuHistory) pbState.tripUpdatesUrlHistory = JSON.parse(tuHistory);
				const vpHistory = localStorage.getItem('vehiclePositionsUrlHistory');
				if (vpHistory) pbState.vehiclePositionsUrlHistory = JSON.parse(vpHistory);
				const saHistory = localStorage.getItem('serviceAlertsUrlHistory');
				if (saHistory) pbState.serviceAlertsUrlHistory = JSON.parse(saHistory);
			} catch (e) {
				console.error('Failed to parse URL history', e);
			}
		}
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('keydown', handleKeyDown);
		}
		stopAutoRefresh();
	});

	$effect(() => {
		if (pbState.autoRefresh) {
			startAutoRefresh();
		} else {
			stopAutoRefresh();
		}
		return () => stopAutoRefresh();
	});

	function addHeader() {
		pbState.headers = [...pbState.headers, { key: '', value: '' }];
	}

	function removeHeader(index: number) {
		pbState.headers = pbState.headers.filter((_, i) => i !== index);
	}

	function updateHeader(index: number, field: 'key' | 'value', value: string) {
		pbState.headers = pbState.headers.map((h, i) => (i === index ? { ...h, [field]: value } : h));
	}

	function saveToLocalStorage() {
		if (typeof localStorage !== 'undefined') {
			localStorage.tripUpdatesUrl = pbState.tripUpdatesUrl;
			localStorage.vehiclePositionsUrl = pbState.vehiclePositionsUrl;
			localStorage.serviceAlertsUrl = pbState.serviceAlertsUrl;
			localStorage.protobufHeaders = JSON.stringify(pbState.headers);
			localStorage.gtfsRtLoggingEnabled = String(pbState.loggingEnabled);
		}
	}

	function startAutoRefresh() {
		stopAutoRefresh();
		pbState.isRefreshing = false;
		if (!pbState.feedData && pbState.configFeeds.length > 0) fetchAllConfigFeeds();
		else if (!pbState.feedData) fetchAllFeedsManual();

		pbState.refreshTimer = window.setInterval(async () => {
			if (pbState.isRefreshing) return;
			pbState.isRefreshing = true;
			try {
				if (pbState.configFeeds.length > 0 && pbState.activeDisplayFeedId) {
					await fetchSingleConfigFeed(pbState.activeDisplayFeedId);
				} else if (pbState.configFeeds.length > 0) {
					await fetchAllConfigFeeds();
				} else {
					await fetchAllFeedsManual();
				}
			} finally {
				pbState.isRefreshing = false;
			}
		}, pbState.refreshInterval * 1000);
	}

	function stopAutoRefresh() {
		if (pbState.refreshTimer !== undefined) {
			clearInterval(pbState.refreshTimer);
			pbState.refreshTimer = undefined;
		}
	}

	async function fetchAllFeedsManual() {
		const hasAnyUrl =
			pbState.tripUpdatesUrl || pbState.vehiclePositionsUrl || pbState.serviceAlertsUrl;
		if (!hasAnyUrl) {
			pbState.error = 'Please enter at least one feed URL';
			return;
		}

		pbState.loading = true;
		pbState.error = undefined;
		saveToLocalStorage();

		if (pbState.tripUpdatesUrl) {
			pbState.tripUpdatesUrlHistory = saveUrlToHistory(
				pbState.tripUpdatesUrl,
				pbState.tripUpdatesUrlHistory
			);
		}
		if (pbState.vehiclePositionsUrl) {
			pbState.vehiclePositionsUrlHistory = saveUrlToHistory(
				pbState.vehiclePositionsUrl,
				pbState.vehiclePositionsUrlHistory
			);
		}
		if (pbState.serviceAlertsUrl) {
			pbState.serviceAlertsUrlHistory = saveUrlToHistory(
				pbState.serviceAlertsUrl,
				pbState.serviceAlertsUrlHistory
			);
		}
		saveUrlHistories();

		const sessionId = crypto.randomUUID();
		const headers = pbState.headers.filter((h) => h.key && h.value);

		try {
			const results = await Promise.allSettled([
				fetchSingleFeedUrl(pbState.tripUpdatesUrl, headers, sessionId),
				fetchSingleFeedUrl(pbState.vehiclePositionsUrl, headers, sessionId),
				fetchSingleFeedUrl(pbState.serviceAlertsUrl, headers, sessionId)
			]);

			const tripData = results[0].status === 'fulfilled' ? results[0].value : null;
			const vehicleData = results[1].status === 'fulfilled' ? results[1].value : null;
			const alertData = results[2].status === 'fulfilled' ? results[2].value : null;

			const errors: string[] = [];
			if (pbState.tripUpdatesUrl && results[0].status === 'rejected') {
				errors.push(`Trip Updates: ${results[0].reason?.message || 'Failed'}`);
			}
			if (pbState.vehiclePositionsUrl && results[1].status === 'rejected') {
				errors.push(`Vehicle Positions: ${results[1].reason?.message || 'Failed'}`);
			}
			if (pbState.serviceAlertsUrl && results[2].status === 'rejected') {
				errors.push(`Service Alerts: ${results[2].reason?.message || 'Failed'}`);
			}

			if (errors.length > 0 && !tripData && !vehicleData && !alertData) {
				pbState.error = errors.join('; ');
				return;
			}

			const allTripUpdates = [
				...(tripData?.tripUpdates || []),
				...(vehicleData?.tripUpdates || []),
				...(alertData?.tripUpdates || [])
			];
			const allVehiclePositions = [
				...(tripData?.vehiclePositions || []),
				...(vehicleData?.vehiclePositions || []),
				...(alertData?.vehiclePositions || [])
			];
			const allAlerts = [
				...(tripData?.alerts || []),
				...(vehicleData?.alerts || []),
				...(alertData?.alerts || [])
			];

			const manualLimited: { tripUpdates: boolean; vehiclePositions: boolean; alerts: boolean } = {
				tripUpdates: tripData?.limited?.tripUpdates ?? false,
				vehiclePositions: vehicleData?.limited?.vehiclePositions ?? false,
				alerts: alertData?.limited?.alerts ?? false
			};
			const manualHasMore: { tripUpdates: boolean; vehiclePositions: boolean; alerts: boolean } = {
				tripUpdates: tripData?.pagination?.hasMore?.tripUpdates ?? false,
				vehiclePositions: vehicleData?.pagination?.hasMore?.vehiclePositions ?? false,
				alerts: alertData?.pagination?.hasMore?.alerts ?? false
			};

			pbState.feedData = {
				header: tripData?.header || vehicleData?.header || alertData?.header,
				tripUpdates: allTripUpdates,
				vehiclePositions: allVehiclePositions,
				alerts: allAlerts,
				entityCount: allTripUpdates.length + allVehiclePositions.length + allAlerts.length,
				totals: {
					tripUpdates: allTripUpdates.length,
					vehiclePositions: allVehiclePositions.length,
					alerts: allAlerts.length
				},
				limited: manualLimited
			};
			pbState.paginationState.hasMore = manualHasMore;

			pbState.currentFetchUrls = {
				tripUpdates: pbState.tripUpdatesUrl,
				vehiclePositions: pbState.vehiclePositionsUrl,
				alerts: pbState.serviceAlertsUrl
			};

			if (errors.length > 0) {
				pbState.error = `Partial success. Errors: ${errors.join('; ')}`;
			}

			if (pbState.feedData && pbState.loggingEnabled) {
				await fetch('/api/gtfs-rt', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						timestamp: new Date().toISOString(),
						data: {
							header: pbState.feedData.header,
							tripUpdates: pbState.feedData.tripUpdates,
							vehiclePositions: pbState.feedData.vehiclePositions,
							alerts: pbState.feedData.alerts,
							entityCount: pbState.feedData.entityCount,
							totals: pbState.feedData.totals,
							limited: pbState.feedData.limited
						}
					})
				});
				logState.triggerUpdate();
			}

			pbState.lastFetchTime = new Date();
		} catch (e) {
			pbState.error = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			pbState.loading = false;
		}
	}

	async function loadMoreEntities(entityType: 'tripUpdates' | 'vehiclePositions' | 'alerts') {
		if (
			!pbState.feedData ||
			pbState.paginationState.loading[entityType] ||
			!pbState.paginationState.hasMore[entityType]
		) {
			return;
		}

		pbState.paginationState.loading[entityType] = true;

		try {
			const url =
				entityType === 'tripUpdates'
					? pbState.currentFetchUrls.tripUpdates
					: entityType === 'vehiclePositions'
						? pbState.currentFetchUrls.vehiclePositions
						: pbState.currentFetchUrls.alerts;

			if (!url) {
				pbState.paginationState.loading[entityType] = false;
				return;
			}

			const currentOffset = (pbState.feedData[entityType] as unknown[])?.length || 0;

			const activeFeed = pbState.activeDisplayFeedId
				? pbState.configFeeds.find((f) => f.id === pbState.activeDisplayFeedId)
				: undefined;
			const paginationHeaders = activeFeed
				? buildFeedHeaders(activeFeed).filter((h) => h.key && h.value)
				: pbState.headers.filter((h) => h.key && h.value);

			const response = await fetch('/api/protobuf', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					url,
					headers: paginationHeaders,
					offset: {
						tripUpdates: entityType === 'tripUpdates' ? currentOffset : 0,
						vehiclePositions: entityType === 'vehiclePositions' ? currentOffset : 0,
						alerts: entityType === 'alerts' ? currentOffset : 0
					}
				})
			});

			const data = await response.json();
			if (data.error) throw new Error(data.error);

			if (entityType === 'tripUpdates' && data.tripUpdates) {
				pbState.feedData.tripUpdates = [
					...(pbState.feedData.tripUpdates || []),
					...data.tripUpdates
				];
			} else if (entityType === 'vehiclePositions' && data.vehiclePositions) {
				pbState.feedData.vehiclePositions = [
					...(pbState.feedData.vehiclePositions || []),
					...data.vehiclePositions
				];
			} else if (entityType === 'alerts' && data.alerts) {
				pbState.feedData.alerts = [...(pbState.feedData.alerts || []), ...data.alerts];
			}

			if (pbState.feedData.limited) {
				pbState.feedData.limited[entityType] = data.pagination?.hasMore?.[entityType] ?? false;
			}

			pbState.paginationState.hasMore[entityType] = data.pagination?.hasMore?.[entityType] ?? false;
		} catch (e) {
			console.error(`Failed to load more ${entityType}:`, e);
		} finally {
			pbState.paginationState.loading[entityType] = false;
		}
	}
</script>

<div
	class="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm transition-colors duration-300 dark:border-gray-700 dark:bg-gray-800"
>
	<div class="space-y-6 p-6">
		<div
			class="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-900/50"
		>
			<div class="mb-3 flex items-center justify-between">
				<div class="flex items-center gap-2">
					<div
						class="rounded-md border border-gray-200 bg-white p-1.5 dark:border-gray-700 dark:bg-gray-800"
					>
						<svg
							class="h-4 w-4 text-gray-500 dark:text-gray-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
					</div>
					<div>
						<span
							class="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
						>
							Maglev Config
						</span>
						<p class="text-xs text-gray-400 dark:text-gray-500">
							Upload your
							<a
								href="https://github.com/OneBusAway/maglev/blob/main/config.example.json"
								target="_blank"
								rel="noopener noreferrer"
								class="font-medium text-green-600 underline underline-offset-2 hover:text-green-700 dark:text-green-400"
							>
								maglev server config
							</a>
							to auto-populate feeds
						</p>
					</div>
				</div>
				{#if pbState.configFileName}
					<button
						onclick={clearConfig}
						class="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400 dark:hover:bg-red-900/20"
					>
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
						Clear
					</button>
				{/if}
			</div>

			{#if pbState.configFeeds.length > 0}
				<div
					class="mb-2 flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50"
				>
					<div class="flex items-center gap-2">
						<svg
							class="h-4 w-4 text-green-500"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<span class="text-xs text-gray-500 dark:text-gray-400">
							{pbState.configFileName}
							<span class="mx-1">•</span>
							{pbState.configFeeds.length} feed{pbState.configFeeds.length !== 1 ? 's' : ''}
						</span>
					</div>
				</div>

				<div class="mb-3 space-y-1.5">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700 dark:text-gray-200">Feeds</span>
						<div class="flex gap-2">
							<button
								onclick={selectAllFeeds}
								class="rounded px-2 py-0.5 text-xs font-medium text-green-600 transition-colors hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
							>
								Select All
							</button>
							<button
								onclick={deselectAllFeeds}
								class="rounded px-2 py-0.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
							>
								None
							</button>
						</div>
					</div>
					<div
						class="max-h-48 space-y-0.5 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1.5 dark:border-gray-700 dark:bg-gray-800/50"
					>
						{#each pbState.configFeeds as feed (feed.id)}
							<label
								class="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
							>
								<input
									type="checkbox"
									checked={pbState.selectedFeedIds[feed.id!] ?? false}
									onchange={() => toggleFeedSelection(feed.id!)}
									class="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 dark:border-gray-600"
								/>
								<div class="flex min-w-0 flex-1 items-center gap-2">
									<span class="truncate font-medium text-gray-800 dark:text-gray-200"
										>{feed.id}</span
									>
									{#if feed['agency-ids']?.length}
										<span class="shrink-0 text-xs text-gray-400">
											{feed['agency-ids'].join(', ')}
										</span>
									{/if}
								</div>
								<div class="flex shrink-0 gap-1">
									{#if feed['trip-updates-url']}
										<span
											class="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400"
											title="Has trip updates">TU</span
										>
									{/if}
									{#if feed['vehicle-positions-url']}
										<span
											class="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
											title="Has vehicle positions">VP</span
										>
									{/if}
									{#if feed['service-alerts-url']}
										<span
											class="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
											title="Has service alerts">SA</span
										>
									{/if}
								</div>
							</label>
						{/each}
					</div>
				</div>
			{:else}
				<div
					role="button"
					tabindex="0"
					ondrop={handleConfigDrop}
					ondragover={(e) => {
						e.preventDefault();
						configDragOver = true;
					}}
					ondragleave={() => {
						configDragOver = false;
					}}
				>
					<div class="relative">
						<input
							type="file"
							accept=".json"
							onchange={handleConfigUpload}
							class="absolute inset-0 cursor-pointer opacity-0"
						/>
						<div
							class="flex flex-col items-center gap-2 rounded-md border-2 border-dashed px-6 py-5 text-center transition-colors {configDragOver
								? 'border-green-400 bg-green-50 dark:bg-green-900/20'
								: 'border-gray-300 dark:border-gray-600'}"
						>
							<svg
								class="h-8 w-8 text-gray-300 dark:text-gray-600"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="1.5"
									d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
								/>
							</svg>
							<div>
								<p class="text-sm font-medium text-gray-600 dark:text-gray-300">
									Drop your <code
										class="rounded bg-gray-200 px-1 py-0.5 font-mono text-xs dark:bg-gray-700"
										>config.json</code
									> here
								</p>
								<p class="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
									or <span class="font-medium text-green-600 dark:text-green-400"
										>click to browse</span
									>
								</p>
							</div>
						</div>
					</div>
					<p class="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
						Need an example?
						<a
							href="https://github.com/OneBusAway/maglev/blob/main/config.example.json"
							target="_blank"
							rel="noopener noreferrer"
							class="font-medium text-green-600 underline underline-offset-2 hover:text-green-700 dark:text-green-400"
							>view example config</a
						>
					</p>
				</div>
			{/if}

			{#if pbState.configError}
				<div
					class="mt-2 flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-1.5 dark:bg-red-900/10"
				>
					<svg
						class="h-3.5 w-3.5 shrink-0 text-red-500"
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
					<p class="text-xs text-red-600 dark:text-red-400">{pbState.configError}</p>
				</div>
			{/if}
		</div>

		{#if Object.keys(pbState.feedResults).length > 0}
			<div
				class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/50"
			>
				<div class="mb-3 flex items-center justify-between">
					<span
						class="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
					>
						Feed Results & Performance
					</span>
					{#if pbState.lastFetchTime}
						<span class="text-xs text-gray-400">
							{pbState.lastFetchTime.toLocaleTimeString()}
						</span>
					{/if}
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead>
							<tr class="border-b border-gray-200 dark:border-gray-700">
								<th class="px-2 py-1.5 font-medium text-gray-500">Feed</th>
								<th class="px-2 py-1.5 font-medium text-gray-500">TU</th>
								<th class="px-2 py-1.5 font-medium text-gray-500">VP</th>
								<th class="px-2 py-1.5 font-medium text-gray-500">SA</th>
								<th class="px-2 py-1.5 font-medium text-gray-500">Total</th>
								<th class="px-2 py-1.5 font-medium text-gray-500">Time</th>
								<th class="px-2 py-1.5 font-medium text-gray-500">Errors</th>
								<th class="px-2 py-1.5 font-medium text-gray-500">View</th>
							</tr>
						</thead>
						<tbody>
							{#each pbState.configFeeds as feed (feed.id)}
								{@const result = pbState.feedResults[feed.id!]}
								{@const timing = pbState.feedTiming[feed.id!]}
								{@const isLoading = pbState.loadingFeeds[feed.id!]}
								{@const isActive = pbState.activeDisplayFeedId === feed.id}
								{#if result || isLoading}
									<tr
										class="border-b border-gray-100 transition-colors dark:border-gray-800 {isActive
											? 'bg-green-50 dark:bg-green-900/10'
											: ''}"
									>
										<td class="px-2 py-1.5 font-medium text-gray-800 dark:text-gray-200">
											{feed.id}
										</td>
										<td class="px-2 py-1.5 text-gray-600 dark:text-gray-400">
											{result?.totals?.tripUpdates ?? '-'}
										</td>
										<td class="px-2 py-1.5 text-gray-600 dark:text-gray-400">
											{result?.totals?.vehiclePositions ?? '-'}
										</td>
										<td class="px-2 py-1.5 text-gray-600 dark:text-gray-400">
											{result?.totals?.alerts ?? '-'}
										</td>
										<td class="px-2 py-1.5 font-medium text-gray-800 dark:text-gray-200">
											{result?.entityCount ?? '-'}
										</td>
										<td class="px-2 py-1.5 text-gray-600 dark:text-gray-400">
											{#if isLoading}
												<span class="text-blue-500">fetching...</span>
											{:else if timing}
												{timing.total.toFixed(0)}ms
											{/if}
										</td>
										<td class="px-2 py-1.5">
											{#if timing?.errors?.length}
												<span class="text-red-500" title={timing.errors.join('; ')}>
													{timing.errors.length}
												</span>
											{/if}
										</td>
										<td class="px-2 py-1.5">
											{#if result}
												<button
													onclick={() => switchToFeed(feed.id!)}
													class="rounded px-2 py-0.5 text-xs font-medium text-green-600 transition-colors hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20 {isActive
														? 'bg-green-100 dark:bg-green-900/30'
														: ''}"
												>
													{isActive ? 'Viewing' : 'View'}
												</button>
											{/if}
										</td>
									</tr>
								{/if}
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		{#if pbState.configFeeds.length === 0}
			<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<div>
					<label
						class="mb-2 block text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
					>
						Trip Updates URL
						<input
							type="text"
							bind:value={pbState.tripUpdatesUrl}
							list="trip-updates-history"
							placeholder="https://example.com/gtfs-rt/trip-updates"
							class="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm text-gray-700 transition-all placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:placeholder:text-gray-600 dark:focus:ring-green-500/40"
						/>
						<datalist id="trip-updates-history">
							{#each pbState.tripUpdatesUrlHistory as url (url)}
								<option value={url}></option>
							{/each}
						</datalist>
					</label>
				</div>
				<div>
					<label
						class="mb-2 block text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
					>
						Vehicle Positions URL
						<input
							type="text"
							bind:value={pbState.vehiclePositionsUrl}
							list="vehicle-positions-history"
							placeholder="https://example.com/gtfs-rt/vehicle-positions"
							class="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm text-gray-700 transition-all placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:placeholder:text-gray-600 dark:focus:ring-green-500/40"
						/>
						<datalist id="vehicle-positions-history">
							{#each pbState.vehiclePositionsUrlHistory as url (url)}
								<option value={url}></option>
							{/each}
						</datalist>
					</label>
				</div>
				<div>
					<label
						class="mb-2 block text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
					>
						Service Alerts URL
						<input
							type="text"
							bind:value={pbState.serviceAlertsUrl}
							list="service-alerts-history"
							placeholder="https://example.com/gtfs-rt/service-alerts"
							class="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm text-gray-700 transition-all placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:placeholder:text-gray-600 dark:focus:ring-green-500/40"
						/>
						<datalist id="service-alerts-history">
							{#each pbState.serviceAlertsUrlHistory as url (url)}
								<option value={url}></option>
							{/each}
						</datalist>
					</label>
				</div>
			</div>

			<div>
				<div class="mb-2 flex items-center justify-between">
					<span
						class="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
						>Custom Headers (API Key, etc.)</span
					>
					<button
						onclick={addHeader}
						class="text-sm font-medium text-green-600 transition-colors hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
					>
						+ Add Header
					</button>
				</div>
				<div class="space-y-2">
					{#each pbState.headers as header, index (index)}
						<div class="flex items-center gap-2">
							<input
								type="text"
								value={header.key}
								oninput={(e) => updateHeader(index, 'key', e.currentTarget.value)}
								placeholder="Header Name (e.g., x-api-key)"
								class="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 font-mono text-sm text-gray-700 transition-all placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:placeholder:text-gray-600"
							/>
							<input
								type="text"
								value={header.value}
								oninput={(e) => updateHeader(index, 'value', e.currentTarget.value)}
								placeholder="Header Value"
								class="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 font-mono text-sm text-gray-700 transition-all placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:placeholder:text-gray-600"
							/>
							{#if pbState.headers.length > 1}
								<button
									onclick={() => removeHeader(index)}
									class="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
									title="Remove header"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-5 w-5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
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
					{/each}
				</div>
			</div>
		{/if}

		<div
			class="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-700"
		>
			<div class="flex items-center gap-4">
				<label class="flex cursor-pointer items-center gap-2 select-none">
					<input
						type="checkbox"
						bind:checked={pbState.autoRefresh}
						class="h-4 w-4 rounded border-gray-300 bg-white text-green-600 focus:ring-green-500 focus:ring-offset-0 dark:border-gray-600 dark:bg-gray-700"
					/>
					<span class="text-sm font-medium text-gray-600 dark:text-gray-400">Auto-refresh</span>
				</label>
				{#if pbState.autoRefresh}
					<div class="flex items-center gap-2">
						<input
							type="number"
							bind:value={pbState.refreshInterval}
							min="5"
							max="300"
							class="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-center text-sm font-medium text-gray-700 focus:border-green-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
						/>
						<span class="text-xs text-gray-400">sec</span>
					</div>
				{/if}
				<div class="h-4 w-px bg-gray-200 dark:bg-gray-700"></div>
				<label class="flex cursor-pointer items-center gap-2 select-none">
					<input
						type="checkbox"
						bind:checked={pbState.loggingEnabled}
						onchange={saveToLocalStorage}
						class="h-4 w-4 rounded border-gray-300 bg-white text-green-600 focus:ring-green-500 focus:ring-offset-0 dark:border-gray-600 dark:bg-gray-700"
					/>
					<span class="text-sm font-medium text-gray-600 dark:text-gray-400">Enable logging</span>
				</label>
				{#if pbState.lastFetchTime}
					<span class="text-xs text-gray-400">
						Last: {pbState.lastFetchTime?.toLocaleTimeString()}
					</span>
				{/if}
			</div>

			{#if pbState.configFeeds.length > 0}
				<button
					onclick={fetchAllConfigFeeds}
					disabled={pbState.loading}
					class="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 font-medium text-white transition-all hover:bg-green-700 hover:shadow-lg active:scale-[0.98] disabled:bg-green-400 disabled:shadow-none"
					title="Fetch Selected Feeds (Ctrl+Enter)"
				>
					{#if pbState.loading}
						<svg
							class="h-4 w-4 animate-spin text-white"
							xmlns="http://www.w3.org/2000/svg"
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
						Fetching...
					{:else}
						<span>Fetch Selected</span>
						<kbd class="ml-1 rounded bg-green-500 px-1.5 py-0.5 text-xs font-normal">Ctrl+↵</kbd>
					{/if}
				</button>
			{:else}
				<button
					onclick={fetchAllFeedsManual}
					disabled={pbState.loading ||
						(!pbState.tripUpdatesUrl && !pbState.vehiclePositionsUrl && !pbState.serviceAlertsUrl)}
					class="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 font-medium text-white transition-all hover:bg-green-700 hover:shadow-lg active:scale-[0.98] disabled:bg-green-400 disabled:shadow-none"
					title="Fetch All Feeds (Ctrl+Enter)"
				>
					{#if pbState.loading}
						<svg
							class="h-4 w-4 animate-spin text-white"
							xmlns="http://www.w3.org/2000/svg"
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
						Fetching...
					{:else}
						<span>Fetch All Feeds</span>
						<kbd class="ml-1 rounded bg-green-500 px-1.5 py-0.5 text-xs font-normal">Ctrl+↵</kbd>
					{/if}
				</button>
			{/if}
		</div>
	</div>
</div>

{#if pbState.error}
	<div
		class="mb-6 flex items-start gap-4 rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900/20 dark:bg-red-900/10"
	>
		<div
			class="rounded-lg border border-red-100 bg-white p-2 font-bold text-red-500 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400"
		>
			!
		</div>
		<div>
			<h3 class="mb-1 font-semibold text-red-900 dark:text-red-200">Request Failed</h3>
			<p class="text-sm text-red-700 dark:text-red-300">{pbState.error}</p>
		</div>
	</div>
{/if}

{#if pbState.feedData}
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100">
			GTFS Realtime Feed Data
			{#if pbState.activeDisplayFeedId}
				<span class="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
					- {pbState.activeDisplayFeedId}
				</span>
			{/if}
		</h2>
	</div>
	<ProtobufViewer
		tripUpdates={pbState.feedData.tripUpdates}
		vehiclePositions={pbState.feedData.vehiclePositions}
		alerts={pbState.feedData.alerts}
		header={pbState.feedData.header}
		entityCount={pbState.feedData.entityCount}
		totals={pbState.feedData.totals}
		limited={pbState.feedData.limited}
		onLoadMore={loadMoreEntities}
		paginationLoading={pbState.paginationState.loading}
		hasMorePages={pbState.paginationState.hasMore}
	/>
{:else if !pbState.loading}
	<div
		class="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-16 text-center transition-colors duration-300 dark:border-gray-700 dark:bg-gray-800"
	>
		<div
			class="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-900"
		>
			<svg class="h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
				></path>
			</svg>
		</div>
		<h3 class="mb-2 text-xl font-semibold text-gray-800 dark:text-white">
			GTFS Realtime Protobuf Reader
		</h3>
		<p class="mb-4 max-w-md text-gray-500">
			Upload a maglev config file above, or manually enter GTFS-RT feed URLs to get started.
		</p>
	</div>
{/if}
