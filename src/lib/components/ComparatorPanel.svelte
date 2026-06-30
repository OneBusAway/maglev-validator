<script lang="ts">
	import { endpoints } from '$lib/endpoints';
	import DiffViewer from '$lib/components/DiffViewer.svelte';
	import { onMount, onDestroy, untrack } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { browser } from '$app/environment';
	import { logState } from '$lib/logState.svelte';
	import { comparatorState as cmpState } from '$lib/panelState.svelte';
	import {
		sortById,
		findIdValue,
		countDifferences,
		countComparableItems
	} from '$lib/utils/jsonCompare';

	let isLogging = $state(false);
	let server1UrlHistory = $state<string[]>([]);
	let server2UrlHistory = $state<string[]>([]);
	let isProcessingData = $state(false);
	let processingMessage = $state('');
	let inputHistory = $state<Record<string, string[]>>({});
	let batchIdsInput = $state('');
	const BATCH_IDS_KEY = 'batchIdsInput';

	function saveBatchIds() {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(BATCH_IDS_KEY, batchIdsInput);
		}
	}

	const hasInPathParam = $derived(
		endpoints.find((e) => e.id === cmpState.selectedEndpoint)?.params.some((p) => p.inPath) ?? false
	);

	const watchedKeys = $derived(
		cmpState.watchedKeysInput
			.split(',')
			.map((k) => k.trim())
			.filter((k) => k.length > 0)
	);

	const ignoredKeys = $derived(
		cmpState.ignoredKeysInput
			.split(',')
			.map((k) => k.trim())
			.filter((k) => k.length > 0)
	);

	const MAX_COMPARABLE_BUDGET = 50000;

	const diffStats = $derived.by(() => {
		if (cmpState.response1 === null || cmpState.response2 === null) return null;
		const total = countComparableItems(
			cmpState.response1,
			cmpState.response2,
			ignoredKeys,
			MAX_COMPARABLE_BUDGET
		);
		const mismatches = countDifferences(cmpState.response1, cmpState.response2, ignoredKeys);
		return {
			total: total.capped ? `${total.count}+` : total.count,
			mismatches,
			matches: total.capped
				? `${Math.max(total.count - mismatches, 0)}+`
				: total.count - mismatches,
			capped: total.capped
		};
	});

	const availableKeys = $derived.by(() => {
		const keys = new Set<string>();
		if (cmpState.response1) collectKeys(cmpState.response1, keys);
		if (cmpState.response2) collectKeys(cmpState.response2, keys);
		return Array.from(keys).sort();
	});

	function collectKeys(obj: unknown, keys: Set<string>, prefix = '') {
		if (!obj || typeof obj !== 'object') return;
		if (Array.isArray(obj)) {
			const path = prefix ? `${prefix}.*` : '*';
			for (const item of obj) {
				collectKeys(item, keys, path);
			}
		} else {
			Object.keys(obj as Record<string, unknown>).forEach((key) => {
				const fullPath = prefix ? `${prefix}.${key}` : key;
				keys.add(fullPath);
				collectKeys((obj as Record<string, unknown>)[key], keys, fullPath);
			});
		}
	}

	function toggleIgnoreKey(key: string) {
		const current = new SvelteSet(ignoredKeys);
		if (current.has(key)) {
			current.delete(key);
		} else {
			current.add(key);
		}
		cmpState.ignoredKeysInput = Array.from(current).join(', ');
		handleIgnoreInput();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.ctrlKey && e.key === 'Enter' && !cmpState.loading) {
			e.preventDefault();
			fetchBoth();
		}

		if (e.key === 'Escape') {
			if (cmpState.showIgnoreModal) cmpState.showIgnoreModal = false;
			if (cmpState.showWatchModal) cmpState.showWatchModal = false;
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);

		if (typeof localStorage !== 'undefined') {
			// Only load from local storage if state is empty (first load)
			if (!cmpState.server1Base) {
				if (localStorage.server1Base) cmpState.server1Base = localStorage.server1Base;
				if (localStorage.server2Base) cmpState.server2Base = localStorage.server2Base;
			}

			// Load URL history
			try {
				const s1History = localStorage.getItem('server1UrlHistory');
				if (s1History) server1UrlHistory = JSON.parse(s1History);
				const s2History = localStorage.getItem('server2UrlHistory');
				if (s2History) server2UrlHistory = JSON.parse(s2History);
			} catch (e) {
				console.error('Failed to parse URL history', e);
			}

			loadInputHistory();
			batchIdsInput = localStorage.getItem(BATCH_IDS_KEY) || '';

			// Load saved params for all endpoints
			if (Object.keys(cmpState.endpointParams).length === 0 && localStorage.comparatorParams) {
				try {
					const saved = JSON.parse(localStorage.comparatorParams);
					if (saved && typeof saved === 'object') {
						cmpState.endpointParams = saved;
					}
				} catch (e) {
					console.error('Failed to parse comparatorParams', e);
				}
			}

			if (!cmpState.ignoredKeysInput) {
				cmpState.ignoredKeysInput =
					localStorage.getItem(`ignore_${cmpState.selectedEndpoint}`) || '';
			}
			if (!cmpState.watchedKeysInput) {
				cmpState.watchedKeysInput =
					localStorage.getItem(`watch_${cmpState.selectedEndpoint}`) || '';
			}
		}

		updateParams();
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('keydown', handleKeyDown);
		}
		stopAutoRefresh();
	});

	$effect(() => {
		void cmpState.selectedEndpoint;
		untrack(() => updateParams());
	});

	$effect(() => {
		const endpoint = cmpState.selectedEndpoint;
		if (typeof localStorage !== 'undefined') {
			cmpState.ignoredKeysInput = localStorage.getItem(`ignore_${endpoint}`) || '';
			cmpState.watchedKeysInput = localStorage.getItem(`watch_${endpoint}`) || '';
		}
	});

	$effect(() => {
		const isAuto = cmpState.autoRefresh;
		const interval = cmpState.refreshInterval;

		untrack(() => {
			if (isAuto) {
				console.log(`[Comparator] Starting auto-refresh (Interval: ${interval}s)`);
				startAutoRefresh();
			} else {
				console.log('[Comparator] Stopping auto-refresh');
				stopAutoRefresh();
			}
		});
		return () => stopAutoRefresh();
	});

	function handleIgnoreInput() {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(`ignore_${cmpState.selectedEndpoint}`, cmpState.ignoredKeysInput);
		}
	}

	function handleWatchInput() {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(`watch_${cmpState.selectedEndpoint}`, cmpState.watchedKeysInput);
		}
	}

	function getValueByPath(obj: unknown, path: string): unknown {
		const normalized = path.replace(/\[(\d+)\]/g, '.$1');
		const parts = normalized.split('.');
		function walk(current: unknown, idx: number): unknown {
			if (idx >= parts.length) return current;
			if (current === null || current === undefined) return undefined;
			const part = parts[idx];

			if (part === '*') {
				if (!Array.isArray(current)) return undefined;
				const hasStableIds = current.every((item) => findIdValue(item) !== null);
				const items = hasStableIds ? [...current].sort(sortById) : current;
				return items.map((item) => walk(item, idx + 1));
			}

			if (Array.isArray(current)) {
				const numericIdx = Number(part);
				if (Number.isInteger(numericIdx)) {
					return walk(current[numericIdx], idx + 1);
				}
				return undefined;
			}

			if (typeof current !== 'object') return undefined;
			return walk((current as Record<string, unknown>)[part], idx + 1);
		}
		return walk(obj, 0);
	}

	async function logWatchedKeys(resp1: unknown, resp2: unknown, idValue?: string) {
		if (watchedKeys.length === 0) return;

		const keys = watchedKeys.map((keyPath) => ({
			path: keyPath,
			server1Value: getValueByPath(resp1, keyPath),
			server2Value: getValueByPath(resp2, keyPath)
		}));

		try {
			isLogging = true;
			await fetch('/api/keylog', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					endpoint: cmpState.selectedEndpoint,
					timestamp: new Date().toISOString(),
					keys,
					response1: resp1,
					response2: resp2,
					idValue: idValue || null
				})
			});
			logState.triggerUpdate();
			cmpState.lastLoggedTime = Date.now();
			setTimeout(() => {
				cmpState.lastLoggedTime = null;
			}, 3000);
		} catch (e) {
			console.error('Failed to log keys:', e);
		} finally {
			isLogging = false;
		}
	}

	function updateParams() {
		const endpoint = endpoints.find((e) => e.id === cmpState.selectedEndpoint);
		if (!endpoint) return;

		const defaults: Record<string, string> = {};
		endpoint.params.forEach((p) => {
			defaults[p.name] = p.default;
		});

		const isSameEndpoint = cmpState.selectedEndpoint === cmpState.lastEndpoint;
		const hasParams = Object.keys(cmpState.params).length > 0;

		if (isSameEndpoint && hasParams) {
			return;
		}

		const saved = cmpState.endpointParams[cmpState.selectedEndpoint];
		if (saved && Object.keys(saved).length > 0) {
			cmpState.params = { ...defaults, ...saved };
		} else {
			cmpState.params = defaults;
		}

		cmpState.lastEndpoint = cmpState.selectedEndpoint;
	}

	function startAutoRefresh() {
		stopAutoRefresh();
		if (!cmpState.loading) fetchBoth();
		cmpState.refreshTimer = window.setInterval(() => {
			fetchBoth();
		}, cmpState.refreshInterval * 1000);
	}

	function stopAutoRefresh() {
		if (cmpState.refreshTimer !== undefined) {
			clearInterval(cmpState.refreshTimer);
			cmpState.refreshTimer = undefined;
		}
	}

	function saveUrlToHistory(url: string, history: string[]): string[] {
		if (!url || history.includes(url)) return history;
		return [url, ...history.filter((u) => u !== url)].slice(0, 5);
	}

	function getInputHistoryKey(endpointId: string, paramName: string): string {
		return `${endpointId}:${paramName}`;
	}

	function getInputHistory(endpointId: string, paramName: string): string[] {
		const key = getInputHistoryKey(endpointId, paramName);
		return inputHistory[key] || [];
	}

	function saveInputToHistory(endpointId: string, paramName: string, value: string) {
		if (!value.trim()) return;
		const key = getInputHistoryKey(endpointId, paramName);
		const history = getInputHistory(endpointId, paramName);
		if (!history.includes(value)) {
			inputHistory[key] = [value, ...history].slice(0, 5);
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem('inputHistory', JSON.stringify(inputHistory));
			}
		}
	}

	function loadInputHistory() {
		if (typeof localStorage !== 'undefined') {
			const saved = localStorage.getItem('inputHistory');
			if (saved) {
				try {
					inputHistory = JSON.parse(saved);
				} catch {
					inputHistory = {};
				}
			}
		}
	}

	async function fetchBoth() {
		if (cmpState.loading) return;
		cmpState.loading = true;
		cmpState.error = undefined;

		if (!cmpState.server1Base || !cmpState.server1Base.startsWith('http')) {
			cmpState.error = 'Server 1 base URL must be an absolute URL (start with http:// or https://)';
			cmpState.loading = false;
			return;
		}
		if (!cmpState.server2Base || !cmpState.server2Base.startsWith('http')) {
			cmpState.error = 'Server 2 base URL must be an absolute URL (start with http:// or https://)';
			cmpState.loading = false;
			return;
		}

		const endpoint = endpoints.find((e) => e.id === cmpState.selectedEndpoint);
		if (!endpoint) {
			cmpState.loading = false;
			return;
		}

		const idParamName = endpoint.params.find((p) => p.inPath)?.name;

		const parsedBatchIds = batchIdsInput
			.split('\n')
			.map((s) => s.trim())
			.filter((s) => s.length > 0);

		const isBatchMode = parsedBatchIds.length > 1 && !!idParamName;
		const idsToFetch = idParamName
			? isBatchMode
				? parsedBatchIds
				: [cmpState.params[idParamName]].filter(Boolean)
			: [''];

		if (idsToFetch.length === 0) {
			cmpState.error = 'Please enter an ID value';
			cmpState.loading = false;
			return;
		}

		const batchResults = new SvelteMap<
			string,
			{
				response1: unknown;
				response2: unknown;
				currentUrl1: string;
				currentUrl2: string;
				status1?: number;
				status2?: number;
				error?: string;
			}
		>();

		const fetchPair = async (id: string) => {
			const params = idParamName ? { ...cmpState.params, [idParamName]: id } : cmpState.params;
			const url1 = buildUrl(cmpState.server1Base, endpoint, params);
			const url2 = buildUrl(cmpState.server2Base, endpoint, params);

			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 5000);

			try {
				const res = await fetch('/api/proxy', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ url1, url2 }),
					signal: controller.signal
				});
				clearTimeout(timeoutId);
				const data = await res.json();
				if (data.error) {
					return { id, result: { error: data.error } as const };
				}
				return {
					id,
					result: {
						response1: data.response1,
						response2: data.response2,
						status1: data.status1,
						status2: data.status2,
						url1,
						url2
					} as const
				};
			} catch (e) {
				clearTimeout(timeoutId);
				const msg = e instanceof Error ? e.message : 'Unknown error';
				return { id, result: { error: msg } as const };
			}
		};

		try {
			const settled = await Promise.allSettled(idsToFetch.map((id) => fetchPair(id)));

			for (const s of settled) {
				if (s.status === 'fulfilled') {
					const { id, result } = s.value;
					if ('error' in result) {
						batchResults.set(id, {
							response1: null,
							response2: null,
							currentUrl1: '',
							currentUrl2: '',
							error: result.error
						});
					} else {
						batchResults.set(id, {
							response1: result.response1,
							response2: result.response2,
							currentUrl1: result.url1,
							currentUrl2: result.url2,
							status1: result.status1,
							status2: result.status2
						});
					}
				}
			}

			const firstId = idsToFetch[0];
			const firstResult = batchResults.get(firstId);

			if (isBatchMode) {
				cmpState.batchIds = idsToFetch;
				cmpState.batchResults = batchResults;
				const prevSelected = cmpState.selectedBatchId;
				cmpState.selectedBatchId =
					batchResults.has(prevSelected) && idsToFetch.includes(prevSelected)
						? prevSelected
						: firstId;
			}

			if (firstResult) {
				if (firstResult.error) {
					cmpState.error = firstResult.error;
				} else {
					cmpState.response1 = firstResult.response1;
					cmpState.response2 = firstResult.response2;
					cmpState.status1 = firstResult.status1 ?? null;
					cmpState.status2 = firstResult.status2 ?? null;
					cmpState.currentUrl1 = firstResult.currentUrl1;
					cmpState.currentUrl2 = firstResult.currentUrl2;
				}
			}

			const dataSize =
				JSON.stringify(cmpState.response1).length + JSON.stringify(cmpState.response2).length;
			if (dataSize > 500000) {
				isProcessingData = true;
				processingMessage = 'Processing large response...';
				await new Promise((r) => setTimeout(r, 50));
			}

			server1UrlHistory = saveUrlToHistory(cmpState.server1Base, server1UrlHistory);
			server2UrlHistory = saveUrlToHistory(cmpState.server2Base, server2UrlHistory);

			Object.entries(cmpState.params).forEach(([paramName, value]) => {
				if (value.trim()) {
					saveInputToHistory(cmpState.selectedEndpoint, paramName, value);
				}
			});

			if (typeof localStorage !== 'undefined') {
				localStorage.setItem('server1UrlHistory', JSON.stringify(server1UrlHistory));
				localStorage.setItem('server2UrlHistory', JSON.stringify(server2UrlHistory));
				localStorage.server1Base = cmpState.server1Base;
				localStorage.server2Base = cmpState.server2Base;
			}

			if (dataSize > 500000) {
				processingMessage = 'Rendering comparison...';
				await new Promise((r) => setTimeout(r, 50));
				isProcessingData = false;
			}

			for (const [id, result] of batchResults) {
				if (!result.error) {
					await logWatchedKeys(result.response1, result.response2, id);
				}
			}
		} catch (e) {
			cmpState.error = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			cmpState.loading = false;
		}
	}

	function selectBatchId(id: string) {
		cmpState.selectedBatchId = id;
		const result = cmpState.batchResults.get(id);
		if (result) {
			cmpState.response1 = result.response1;
			cmpState.response2 = result.response2;
			cmpState.status1 = result.status1 ?? null;
			cmpState.status2 = result.status2 ?? null;
			cmpState.currentUrl1 = result.currentUrl1;
			cmpState.currentUrl2 = result.currentUrl2;
			if (result.error) {
				cmpState.error = result.error;
			} else {
				cmpState.error = undefined;
			}
		} else {
			cmpState.error = undefined;
		}
	}

	function buildUrl(
		base: string,
		endpoint: (typeof endpoints)[number],
		params: Record<string, string>
	): string {
		let path = endpoint.path;
		let queryParams: string[] = [];

		Object.entries(params).forEach(([key, value]) => {
			if (endpoint.params.find((p) => p.name === key && p.inPath)) {
				path = path.replace(`{${key}}`, value);
			} else if (value !== '' && value !== undefined && value !== null) {
				queryParams.push(`${key}=${encodeURIComponent(value)}`);
			}
		});

		return base + path + (queryParams.length ? '?' + queryParams.join('&') : '');
	}

	let paramDebounceTimer: number | undefined = undefined;
	function handleParamChange(paramName: string, value: string) {
		cmpState.params = { ...cmpState.params, [paramName]: value };

		const currentSaved = cmpState.endpointParams[cmpState.selectedEndpoint] || {};
		cmpState.endpointParams[cmpState.selectedEndpoint] = {
			...currentSaved,
			[paramName]: value
		};

		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('comparatorParams', JSON.stringify(cmpState.endpointParams));
		}

		if (paramDebounceTimer !== undefined) {
			clearTimeout(paramDebounceTimer);
		}
		paramDebounceTimer = window.setTimeout(() => {
			fetchBoth();
			paramDebounceTimer = undefined;
		}, 600);
	}
</script>

<div
	class="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm transition-colors duration-300 dark:border-gray-700 dark:bg-gray-800"
>
	<div class="space-y-6 p-6">
		<div class="grid grid-cols-2 gap-6">
			<div>
				<label
					for="server1-url"
					class="mb-2 block text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
					>Server 1 URL</label
				>
				<input
					id="server1-url"
					type="text"
					bind:value={cmpState.server1Base}
					list="server1-url-history"
					class="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm text-gray-700 transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:ring-green-500/40"
				/>
				<datalist id="server1-url-history">
					{#each server1UrlHistory as url (url)}
						<option value={url}></option>
					{/each}
				</datalist>
			</div>
			<div>
				<label
					for="server2-url"
					class="mb-2 block text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
					>Server 2 URL</label
				>
				<input
					id="server2-url"
					type="text"
					bind:value={cmpState.server2Base}
					list="server2-url-history"
					class="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm text-gray-700 transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:ring-green-500/40"
				/>
				<datalist id="server2-url-history">
					{#each server2UrlHistory as url (url)}
						<option value={url}></option>
					{/each}
				</datalist>
			</div>
		</div>

		<div class="grid grid-cols-12 gap-6">
			<div class="col-span-3">
				<label
					for="api-endpoint"
					class="mb-2 block text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
					>API Endpoint</label
				>
				<div class="relative">
					<select
						id="api-endpoint"
						bind:value={cmpState.selectedEndpoint}
						class="w-full cursor-pointer appearance-none rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:focus:ring-green-500/40"
					>
						{#each endpoints as endpoint (endpoint.id)}
							<option value={endpoint.id}>{endpoint.name}</option>
						{/each}
					</select>
				</div>
			</div>

			{#each endpoints.find((e) => e.id === cmpState.selectedEndpoint)?.params || [] as param (param.name)}
				{@const history = getInputHistory(cmpState.selectedEndpoint, param.name)}
				<div class="col-span-3">
					<label
						for={'param-' + param.name}
						class="mb-2 flex items-center gap-1 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
					>
						{param.label}
						{#if param.required}<span class="text-red-500"> * </span>{/if}
					</label>
					<input
						id={'param-' + param.name}
						type="text"
						value={cmpState.params[param.name] || ''}
						oninput={(e) => handleParamChange(param.name, e.currentTarget.value)}
						placeholder={param.placeholder || ''}
						list={'param-history-' + param.name}
						class="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:ring-green-500/40"
					/>
					{#if history.length > 0}
						<datalist id={'param-history-' + param.name}>
							{#each history as value (value)}
								<option {value}></option>
							{/each}
						</datalist>
					{/if}
				</div>
			{/each}

			{#if hasInPathParam}
				<div class="col-span-3">
					<label
						for="batch-ids"
						class="mb-2 flex items-center gap-1 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
					>
						Batch IDs
						<span class="text-xs font-normal text-gray-400 normal-case"
							>(one per line for multi-ID comparison)</span
						>
					</label>
					<textarea
						id="batch-ids"
						value={batchIdsInput}
						oninput={(e) => {
							batchIdsInput = (e.target as HTMLTextAreaElement).value;
							saveBatchIds();
						}}
						placeholder="1_12345&#10;1_67890&#10;1_11111"
						rows="3"
						class="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm text-gray-700 transition-all placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:placeholder:text-gray-600"
					></textarea>
				</div>
			{/if}

			<div class="col-span-2">
				<label
					for="json-path-filter"
					class="mb-2 block text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
					>JSON Path Filter</label
				>
				<input
					id="json-path-filter"
					type="text"
					bind:value={cmpState.focusPath}
					placeholder="e.g. data.entry.status"
					class="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 transition-all placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:placeholder:text-gray-600 dark:focus:ring-green-500/40"
				/>
			</div>

			<div class="col-span-2">
				<label
					for="ignore-keys-trigger"
					class="mb-2 block text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
					>Ignored Keys</label
				>
				<button
					id="ignore-keys-trigger"
					onclick={() => (cmpState.showIgnoreModal = true)}
					class="group flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm text-gray-700 transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:ring-green-500/40"
				>
					<span class="truncate">
						{ignoredKeys.length ? `${ignoredKeys.length} keys ignored` : 'Select keys...'}
					</span>
					<span class="text-gray-400 transition-colors group-hover:text-green-500">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</span>
				</button>
			</div>

			<div class="col-span-2">
				<label
					for="watch-keys-trigger"
					class="mb-2 block text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
					>Watch Keys <span class="text-green-500">(Log)</span></label
				>
				<button
					id="watch-keys-trigger"
					onclick={() => (cmpState.showWatchModal = true)}
					class="group flex w-full items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-left text-sm text-green-700 transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none dark:border-green-900/30 dark:bg-green-900/20 dark:text-green-300 dark:focus:ring-green-500/40"
				>
					<span class="truncate">
						{#if cmpState.lastLoggedTime}
							<span class="animate-pulse font-medium text-green-600 dark:text-green-400"
								>Logged!</span
							>
						{:else if isLogging}
							<span class="font-medium text-green-600 dark:text-green-400">Logging...</span>
						{:else}
							{watchedKeys.length ? `${watchedKeys.length} keys watched` : 'Select keys...'}
						{/if}
					</span>
					<span
						class="text-green-400 transition-colors group-hover:text-green-600 dark:group-hover:text-green-200"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</span>
				</button>
			</div>
		</div>

		<div
			class="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-700"
		>
			<div class="flex items-center gap-4">
				<label class="flex cursor-pointer items-center gap-2 select-none">
					<input
						type="checkbox"
						bind:checked={cmpState.autoRefresh}
						class="h-4 w-4 rounded border-gray-300 bg-white text-green-600 focus:ring-green-500 focus:ring-offset-0 dark:border-gray-600 dark:bg-gray-700"
					/>
					<span class="text-sm font-medium text-gray-600 dark:text-gray-400">Auto-refresh</span>
				</label>
				{#if cmpState.autoRefresh}
					<div class="flex items-center gap-2">
						<input
							type="number"
							bind:value={cmpState.refreshInterval}
							min="1"
							max="60"
							class="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-center text-sm font-medium text-gray-700 focus:border-green-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
						/>
						<span class="text-xs text-gray-400">sec</span>
					</div>
				{/if}

				<div class="ml-4 flex items-center gap-2">
					<label class="text-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400"
						>Tolerance ±%</label
					>
					<input
						type="number"
						bind:value={cmpState.numericTolerancePercent}
						min="0"
						max="100"
						step="0.5"
						class="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-center text-sm font-medium text-gray-700 focus:border-green-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
					/>
				</div>
			</div>

			<button
				onclick={fetchBoth}
				disabled={cmpState.loading}
				class="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white transition-all hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
				title="Run Comparison (Ctrl+Enter)"
			>
				{#if cmpState.loading}
					<svg
						class="h-4 w-4 animate-spin text-white"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					Running...
				{:else}
					<span>Run Comparison</span>
					<kbd class="ml-1 rounded bg-green-500 px-1.5 py-0.5 text-xs font-normal">Ctrl+↵</kbd>
				{/if}
			</button>
		</div>
	</div>
</div>

{#if cmpState.error}
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
			<p class="text-sm text-red-700 dark:text-red-300">{cmpState.error}</p>
		</div>
	</div>
{/if}

{#if cmpState.status1 !== null || cmpState.status2 !== null}
	<div class="mb-4 flex items-center justify-between">
		<div class="flex items-center gap-4">
			<h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100">Response Comparison</h2>
			{#if cmpState.batchIds.length > 1}
				<div class="flex items-center gap-2">
					<select
						class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 focus:border-green-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
						value={cmpState.selectedBatchId}
						onchange={(e) => selectBatchId(e.currentTarget.value)}
					>
						{#each cmpState.batchIds as id (id)}
							<option value={id}
								>{id}{cmpState.batchResults.get(id)?.error ? ' (failed)' : ''}</option
							>
						{/each}
					</select>
					<span class="text-xs text-gray-400">
						{cmpState.selectedBatchId &&
						cmpState.batchResults.get(cmpState.selectedBatchId)?.currentUrl1
							? '1 URL shown'
							: ''}
					</span>
				</div>
			{/if}
		</div>
		<div class="flex items-center gap-6 text-sm font-medium">
			<span class="mr-4 flex items-center gap-2 text-gray-600 dark:text-gray-400">
				<span class="h-3 w-3 rounded bg-red-500"></span> Different
			</span>
			<span class="mr-4 flex items-center gap-2 text-gray-600 dark:text-gray-400">
				<span class="h-3 w-3 rounded bg-orange-400"></span> Missing
			</span>
			<span class="flex items-center gap-2 text-gray-600 dark:text-gray-400">
				<span class="h-3 w-3 rounded bg-green-500"></span> Extra
			</span>
		</div>
	</div>

	{#if cmpState.currentUrl1 || cmpState.currentUrl2}
		<div
			class="mb-4 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
		>
			<div class="text-xs font-medium text-gray-500 dark:text-gray-400">Fetched URLs:</div>
			{#if cmpState.currentUrl1}
				<div class="flex items-start gap-2">
					<span
						class="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
						>1</span
					>
					{#if cmpState.status1 !== null}
						<span
							class="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium {cmpState.status1 >= 400
								? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
								: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'}"
							>{cmpState.status1}</span
						>
					{/if}
					<code class="text-xs break-all text-gray-700 dark:text-gray-300"
						>{cmpState.currentUrl1}</code
					>
				</div>
			{/if}
			{#if cmpState.currentUrl2}
				<div class="flex items-start gap-2">
					<span
						class="shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
						>2</span
					>
					{#if cmpState.status2 !== null}
						<span
							class="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium {cmpState.status2 >= 400
								? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
								: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'}"
							>{cmpState.status2}</span
						>
					{/if}
					<code class="text-xs break-all text-gray-700 dark:text-gray-300"
						>{cmpState.currentUrl2}</code
					>
				</div>
			{/if}
		</div>
	{/if}

	{#if diffStats}
		<div
			class="mb-4 flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800/50"
		>
			{#if diffStats.mismatches === 0}
				<span class="flex items-center gap-1.5 font-medium text-green-700 dark:text-green-400">
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2.5"
							d="M5 13l4 4L19 7"
						/>
					</svg>
					All {diffStats.total} fields match
				</span>
			{:else}
				<span class="flex items-center gap-1.5 font-medium text-red-600 dark:text-red-400">
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2.5"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
					{diffStats.mismatches} mismatch{diffStats.mismatches !== 1 ? 'es' : ''}
				</span>
				<span class="text-gray-500 dark:text-gray-400">
					{diffStats.matches} / {diffStats.total} match
				</span>
			{/if}
			{#if ignoredKeys.length > 0}
				<span class="ml-auto text-xs text-gray-400 dark:text-gray-500">
					({ignoredKeys.length} key{ignoredKeys.length !== 1 ? 's' : ''} ignored)
				</span>
			{/if}
		</div>
	{/if}

	<div class="relative">
		{#if isProcessingData}
			<div
				class="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm dark:bg-gray-900/80"
			>
				<div class="flex flex-col items-center gap-3">
					<svg class="h-8 w-8 animate-spin text-green-600" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					<span class="text-sm font-medium text-gray-700 dark:text-gray-300"
						>{processingMessage}</span
					>
				</div>
			</div>
		{/if}
		<DiffViewer
			response1={cmpState.response1}
			response2={cmpState.response2}
			focusPath={cmpState.focusPath}
			{ignoredKeys}
			numericTolerancePercent={cmpState.numericTolerancePercent}
		/>
	</div>
{:else if !cmpState.loading}
	<div
		class="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-16 text-center transition-colors duration-300 dark:border-gray-700 dark:bg-gray-800"
	>
		<div
			class="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-900"
		>
			<svg class="h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"
				><path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
				></path></svg
			>
		</div>
		<h3 class="mb-2 text-xl font-semibold text-gray-800 dark:text-white">Ready to Compare</h3>
		<p class="max-w-md text-gray-500">
			Configure your endpoints above, then click <strong class="text-green-600"
				>Run Comparison</strong
			> to analyze the API response differences.
		</p>
	</div>
{/if}

{#if cmpState.showIgnoreModal}
	<div
		class="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm transition-all sm:p-6"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-2xl dark:bg-gray-800"
		>
			<div
				class="flex items-center justify-between border-b border-gray-100 p-4 dark:border-gray-700"
			>
				<h3 class="text-lg font-semibold text-gray-800 dark:text-white">Ignore Keys</h3>
				<button
					onclick={() => (cmpState.showIgnoreModal = false)}
					class="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
					aria-label="Close"
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
			</div>

			<div
				class="border-b border-gray-100 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
			>
				<input
					type="text"
					bind:value={cmpState.ignoreSearch}
					placeholder="Search keys..."
					class="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
				/>
			</div>

			<div class="flex-1 overflow-y-auto p-2">
				{#if availableKeys.length === 0}
					<div class="p-8 text-center text-gray-400 italic">
						No keys found. Run a comparison first!
					</div>
				{:else}
					{@const filteredKeys = availableKeys
						.filter((k) => k.toLowerCase().includes(cmpState.ignoreSearch.toLowerCase()))
						.sort((a, b) => {
							const aSel = ignoredKeys.includes(a);
							const bSel = ignoredKeys.includes(b);
							if (aSel && !bSel) return -1;
							if (!aSel && bSel) return 1;
							return a.localeCompare(b);
						})}
					<div class="grid grid-cols-1 gap-1">
						{#each filteredKeys as key (key)}
							<label
								class="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
							>
								<input
									type="checkbox"
									checked={ignoredKeys.includes(key)}
									onchange={() => toggleIgnoreKey(key)}
									class="h-4 w-4 rounded border-gray-300 bg-white text-green-600 focus:ring-green-500 focus:ring-offset-0 dark:border-gray-600 dark:bg-gray-700"
								/>
								<span class="font-mono text-sm font-medium text-gray-700 dark:text-gray-300"
									>{key}</span
								>
								{#if ignoredKeys.includes(key)}
									<span class="ml-auto text-xs font-medium text-green-600 dark:text-green-400"
										>Ignored</span
									>
								{/if}
							</label>
						{/each}
						{#if filteredKeys.length === 0}
							<div class="p-4 text-center text-sm text-gray-400">
								No keys match "{cmpState.ignoreSearch}"
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<div
				class="flex justify-between gap-3 rounded-b-xl border-t border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
			>
				<button
					onclick={() => {
						cmpState.ignoredKeysInput = '';
						handleIgnoreInput();
					}}
					class="px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
				>
					Clear Selection
				</button>
				<button
					onclick={() => (cmpState.showIgnoreModal = false)}
					class="px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}

{#if cmpState.showWatchModal}
	<div
		class="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm transition-all sm:p-6"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-2xl dark:bg-gray-800"
		>
			<div
				class="flex items-center justify-between border-b border-gray-100 p-4 dark:border-gray-700"
			>
				<h3 class="text-lg font-semibold text-gray-800 dark:text-white">Watch Keys for Logging</h3>
				<button
					onclick={() => (cmpState.showWatchModal = false)}
					class="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
					aria-label="Close"
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
			</div>

			<div
				class="border-b border-gray-100 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
			>
				<input
					type="text"
					bind:value={cmpState.watchSearch}
					placeholder="Search keys..."
					class="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
				/>
			</div>

			<div class="flex-1 overflow-y-auto p-2">
				{#if availableKeys.length === 0}
					<div class="p-8 text-center text-gray-400 italic">
						No keys found. Run a comparison first!
					</div>
				{:else}
					{@const filteredKeys = availableKeys
						.filter((k) => k.toLowerCase().includes(cmpState.watchSearch.toLowerCase()))
						.sort((a, b) => {
							const aSel = watchedKeys.includes(a);
							const bSel = watchedKeys.includes(b);
							if (aSel && !bSel) return -1;
							if (!aSel && bSel) return 1;
							return a.localeCompare(b);
						})}
					<div class="grid grid-cols-1 gap-1">
						{#each filteredKeys as key (key)}
							<label
								class="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
							>
								<input
									type="checkbox"
									checked={watchedKeys.includes(key)}
									onchange={() => cmpState.toggleWatchKey(key)}
									class="h-4 w-4 rounded border-gray-300 bg-white text-green-600 focus:ring-green-500 focus:ring-offset-0 dark:border-gray-600 dark:bg-gray-700"
								/>
								<span class="font-mono text-sm font-medium text-gray-700 dark:text-gray-300"
									>{key}</span
								>
								{#if watchedKeys.includes(key)}
									<span class="ml-auto text-xs font-medium text-green-600 dark:text-green-400"
										>Watching</span
									>
								{/if}
							</label>
						{/each}
						{#if filteredKeys.length === 0}
							<div class="p-4 text-center text-sm text-gray-400">
								No keys match "{cmpState.watchSearch}"
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<div
				class="flex justify-between gap-3 rounded-b-xl border-t border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
			>
				<button
					onclick={() => {
						cmpState.watchedKeysInput = '';
						handleWatchInput();
					}}
					class="px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
				>
					Clear Selection
				</button>
				<button
					onclick={() => (cmpState.showWatchModal = false)}
					class="px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
