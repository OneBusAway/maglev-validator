<script lang="ts">
	import JsonViewer from './JsonViewer.svelte';
	import { getByPath } from '$lib/utils/jsonCompare';
	import { deepSearchJSON } from '$lib/utils/search';
	import { SvelteSet, SvelteMap } from 'svelte/reactivity';

	interface Props {
		response1: unknown;
		response2: unknown;
		focusPath?: string;
		ignoredKeys?: string[];
	}

	let { response1, response2, focusPath = '', ignoredKeys = [] }: Props = $props();

	const trimmedPath = $derived(focusPath.trim());
	const focused1 = $derived(trimmedPath ? getByPath(response1, trimmedPath) : response1);
	const focused2 = $derived(trimmedPath ? getByPath(response2, trimmedPath) : response2);

	let sorted1 = $state<unknown>(null);
	let sorted2 = $state<unknown>(null);
	let sortLoading = $state(false);
	let sortEnabled = $state(false);

	async function doSort() {
		if (sortEnabled) {
			// Revert to original
			sorted1 = null;
			sorted2 = null;
			sortEnabled = false;
			return;
		}

		sortLoading = true;
		sortEnabled = true;
		await new Promise((r) => setTimeout(r, 0));

		const ID_FIELDS = ['tripId', 'id', 'activeTripId', 'routeId', 'stopId', 'vehicleId', 'blockId'];

		function getId(item: Record<string, unknown>): string {
			for (const field of ID_FIELDS) {
				if (item && typeof item[field] === 'string' && item[field]) {
					return item[field];
				}
				if (item && typeof item[field] === 'number') {
					return String(item[field]);
				}
			}
			return JSON.stringify(item);
		}

		function findArray(data: unknown): unknown[] {
			if (!data) return [];
			if (Array.isArray(data)) return data;

			// Search for array in common locations
			const keys = ['list', 'data', 'items', 'results', 'elements', 'entities'];
			for (const key of keys) {
				if (data[key] && Array.isArray(data[key]) && data[key].length > 0) {
					// Check if first item has an ID field
					const firstItem = data[key][0];
					if (firstItem && typeof firstItem === 'object') {
						for (const idField of ID_FIELDS) {
							if (firstItem[idField]) return data[key];
						}
					}
				}
			}

			// Search recursively for first array with objects having IDs
			function search(obj: unknown): unknown[] | null {
				if (!obj || typeof obj !== 'object') return null;
				if (Array.isArray(obj)) return obj.length > 0 ? obj : null;

				for (const value of Object.values(obj as Record<string, unknown>)) {
					const result = search(value);
					if (result) return result;
				}
				return null;
			}

			return search(data) || [];
		}

		const arr1 = findArray(focused1);
		const arr2 = findArray(focused2);

		if (arr1.length > 0 && arr2.length > 0) {
			// Create matched pairs by ID
			const leftMap = new SvelteMap<string, unknown[]>();
			const rightMap = new SvelteMap<string, unknown[]>();

			for (const item of arr1) {
				const id = getId(item as Record<string, unknown>);
				if (!leftMap.has(id)) leftMap.set(id, []);
				leftMap.get(id)!.push(item);
			}

			for (const item of arr2) {
				const id = getId(item as Record<string, unknown>);
				if (!rightMap.has(id)) rightMap.set(id, []);
				rightMap.get(id)!.push(item);
			}

			// Get all unique IDs
			const allIds = new Set([...leftMap.keys(), ...rightMap.keys()]);

			const matched1 = [];
			const matched2 = [];

			// First add matching IDs (items that exist on both sides)
			for (const id of allIds) {
				const items1 = leftMap.get(id) || [];
				const items2 = rightMap.get(id) || [];
				const maxLen = Math.max(items1.length, items2.length);

				for (let i = 0; i < maxLen; i++) {
					matched1.push(items1[i] || null);
					matched2.push(items2[i] || null);
				}
			}

			sorted1 = matched1;
			sorted2 = matched2;
		}

		sortLoading = false;
	}

	let localSearchQuery = $state('');
	let debouncedSearchQuery = $state('');
	let isSearching = $state(false);
	let searchResults1 = $state<Array<{ path: string; value: unknown; context: string }>>([]);
	let searchResults2 = $state<Array<{ path: string; value: unknown; context: string }>>([]);

	function buildMatchingPaths(results: Array<{ path: string }>): SvelteSet<string> {
		const paths = new SvelteSet<string>();
		for (const result of results) {
			const parts = result.path.split(/\.|\[|\]/).filter(Boolean);
			let currentPath = '';
			for (const part of parts) {
				currentPath = currentPath ? `${currentPath}.${part}` : part;
				paths.add(currentPath);
			}
			paths.add(result.path);
		}
		return paths;
	}

	const matchingPaths1 = $derived(buildMatchingPaths(searchResults1));
	const matchingPaths2 = $derived(buildMatchingPaths(searchResults2));

	const MIN_SEARCH_LENGTH = 2;

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	function updateSearch(query: string) {
		if (debounceTimer) clearTimeout(debounceTimer);

		if (query.trim().length < MIN_SEARCH_LENGTH) {
			debouncedSearchQuery = '';
			searchResults1 = [];
			searchResults2 = [];
			isSearching = false;
			return;
		}

		debounceTimer = setTimeout(() => {
			debouncedSearchQuery = query;
			searchResults1 = deepSearchJSON(focused1, query, 200);
			searchResults2 = deepSearchJSON(focused2, query, 200);
			isSearching = false;
		}, 400);
	}

	function handleSearchInput(e: Event) {
		const value = (e.target as HTMLInputElement).value;
		localSearchQuery = value;
		isSearching = value.trim().length >= MIN_SEARCH_LENGTH;
		updateSearch(value);
	}

	function clearSearch() {
		localSearchQuery = '';
		debouncedSearchQuery = '';
		searchResults1 = [];
		searchResults2 = [];
		isSearching = false;
	}

	const totalMatches = $derived(searchResults1.length + searchResults2.length);

	let syncScroll = $state(true);
	let scrollContainer1: HTMLDivElement;
	let scrollContainer2: HTMLDivElement;
	let isScrolling = $state(false);

	function handleScroll(source: 'left' | 'right') {
		if (!syncScroll || isScrolling) return;
		isScrolling = true;

		const sourceEl = source === 'left' ? scrollContainer1 : scrollContainer2;
		const targetEl = source === 'left' ? scrollContainer2 : scrollContainer1;

		if (sourceEl && targetEl) {
			targetEl.scrollTop = sourceEl.scrollTop;
			targetEl.scrollLeft = sourceEl.scrollLeft;
		}

		requestAnimationFrame(() => {
			isScrolling = false;
		});
	}

	let syncSelect = $state(true);
	let syncedExpandedPaths = new SvelteSet<string>();

	function handleToggle(path: string, expanded: boolean) {
		if (!syncSelect) return;
		if (expanded) {
			syncedExpandedPaths.add(path);
		} else {
			syncedExpandedPaths.delete(path);
		}
	}
</script>

<div class="mb-4 flex items-center gap-4">
	<div class="relative max-w-md flex-1">
		<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
			{#if isSearching}
				<svg
					class="h-4 w-4 animate-spin text-indigo-500"
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
			{:else}
				<svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
					></path>
				</svg>
			{/if}
		</div>
		<input
			type="text"
			bind:value={localSearchQuery}
			oninput={handleSearchInput}
			placeholder="Search (min 2 chars)..."
			class="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pr-10 pl-10 text-sm text-gray-700 transition-all placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500"
		/>
		{#if localSearchQuery}
			<button
				onclick={clearSearch}
				class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
				title="Clear search"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					></path>
				</svg>
			</button>
		{/if}
	</div>

	<button
		onclick={() => (syncScroll = !syncScroll)}
		class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all {syncScroll
			? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400'
			: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'}"
		title="{syncScroll ? 'Disable' : 'Enable'} synchronized scrolling"
	>
		<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
			></path>
		</svg>
		Sync Scroll
	</button>

	<button
		onclick={() => (syncSelect = !syncSelect)}
		class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all {syncSelect
			? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400'
			: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'}"
		title="{syncSelect ? 'Disable' : 'Enable'} synchronized expand/collapse"
	>
		<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M4 6h16M4 12h16m-7 6h7"
			></path>
		</svg>
		Sync Select
	</button>

	<button
		onclick={doSort}
		disabled={sortLoading}
		class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all {sortEnabled
			? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400'
			: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'}"
		title="Sort arrays by ID to align matching items"
	>
		{#if sortLoading}
			<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
				></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
				></path>
			</svg>
		{:else}
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
				></path>
			</svg>
		{/if}
		{sortEnabled ? 'Reset' : 'Sort by ID'}
	</button>

	{#if debouncedSearchQuery}
		<div class="flex items-center gap-3 text-sm">
			{#if totalMatches > 0}
				<span class="flex items-center gap-1.5 text-yellow-700 dark:text-yellow-400">
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						></path>
					</svg>
					<span class="font-medium">{totalMatches} matches</span>
					<span class="text-gray-400"
						>({searchResults1.length} left, {searchResults2.length} right)</span
					>
				</span>
			{:else}
				<span class="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
						></path>
					</svg>
					<span>No matches found</span>
				</span>
			{/if}
		</div>
	{/if}
</div>

<div
	class="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 dark:border-gray-700 dark:bg-gray-700"
>
	<div
		class="bg-gray-50 px-4 py-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:bg-gray-800 dark:text-gray-400"
	>
		Server 1 Response
	</div>
	<div
		class="border-l border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
	>
		Server 2 Response
	</div>

	<div
		bind:this={scrollContainer1}
		onscroll={() => handleScroll('left')}
		class="max-h-[800px] overflow-auto bg-white dark:bg-gray-900"
	>
		<JsonViewer
			data={sorted1 ?? focused1}
			otherData={sorted2 ?? focused2}
			{focusPath}
			{ignoredKeys}
			mode="server1"
			searchQuery={debouncedSearchQuery}
			matchingPaths={matchingPaths1}
			{syncedExpandedPaths}
			onToggle={syncSelect ? handleToggle : undefined}
		/>
	</div>
	<div
		bind:this={scrollContainer2}
		onscroll={() => handleScroll('right')}
		class="max-h-[800px] overflow-auto border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
	>
		<JsonViewer
			data={sorted2 ?? focused2}
			otherData={focused1}
			{focusPath}
			{ignoredKeys}
			mode="server2"
			searchQuery={debouncedSearchQuery}
			matchingPaths={matchingPaths2}
			{syncedExpandedPaths}
			onToggle={syncSelect ? handleToggle : undefined}
		/>
	</div>
</div>
