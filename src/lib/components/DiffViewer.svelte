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
	let showSortModal = $state(false);

	let savedArrayPath = $state('auto');
	let savedIdField = $state('auto');

	$effect(() => {
		void focused1;
		void focused2;
		if (sortEnabled && savedArrayPath) {
			applySorting(savedArrayPath, savedIdField);
		}
	});

	const ID_FIELDS = [
		{ value: 'auto', label: 'Auto-detect', desc: 'Find best matching ID field' },
		{ value: 'id', label: 'id', desc: 'General ID field' },
		{ value: 'tripId', label: 'tripId', desc: 'Trip identifier' },
		{ value: 'activeTripId', label: 'activeTripId', desc: 'Active trip identifier' },
		{ value: 'routeId', label: 'routeId', desc: 'Route identifier' },
		{ value: 'stopId', label: 'stopId', desc: 'Stop identifier' },
		{ value: 'vehicleId', label: 'vehicleId', desc: 'Vehicle identifier' },
		{ value: 'blockId', label: 'blockId', desc: 'Block identifier' },
		{ value: 'serviceId', label: 'serviceId', desc: 'Service identifier' },
		{ value: 'calendarId', label: 'calendarId', desc: 'Calendar identifier' },
		{ value: 'agencyId', label: 'agencyId', desc: 'Agency identifier' }
	];

	interface DetectedArray {
		path: string;
		pathLabel: string;
		count: number;
		detectedIdField: string | null;
	}

	const detectedArrays = $derived.by(() => {
		const arrays: DetectedArray[] = [];
		const idFields = ID_FIELDS.filter((f) => f.value !== 'auto').map((f) => f.value);

		function scan(obj: unknown, path: string = '') {
			if (!obj || typeof obj !== 'object') return;

			if (Array.isArray(obj) && obj.length > 0) {
				const isPrimitiveArray = typeof obj[0] === 'string' || typeof obj[0] === 'number';
				let detectedId: string | null = null;

				if (!isPrimitiveArray && obj[0] && typeof obj[0] === 'object') {
					for (const field of idFields) {
						if ((obj[0] as Record<string, unknown>)[field] !== undefined) {
							detectedId = field;
							break;
						}
					}
				}

				const pathLabel = path || 'Root Array';
				arrays.push({
					path,
					pathLabel,
					count: obj.length,
					detectedIdField: detectedId
				});
			}

			if (!Array.isArray(obj)) {
				for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
					const newPath = path ? `${path}.${key}` : key;
					scan(value, newPath);
				}
			}
		}

		scan(focused1);
		return arrays;
	});

	let selectedArrayPath = $state('auto');
	let selectedIdField = $state('auto');

	$effect(() => {
		if (detectedArrays.length > 0 && selectedArrayPath === 'auto') {
			const firstWithId = detectedArrays.find((a) => a.detectedIdField);
			selectedArrayPath = firstWithId?.path ?? detectedArrays[0].path;
			selectedIdField = firstWithId?.detectedIdField ?? 'auto';
		}
	});

	function applySorting(arrayPath: string, idField: string) {
		const autoIdFields = ID_FIELDS.filter((f) => f.value !== 'auto').map((f) => f.value);
		const fieldsToUse = idField === 'auto' ? autoIdFields : [idField];

		function getId(item: Record<string, unknown>): string {
			for (const field of fieldsToUse) {
				if (item && typeof item[field] === 'string' && item[field]) {
					return item[field];
				}
				if (item && typeof item[field] === 'number') {
					return String(item[field]);
				}
			}
			return JSON.stringify(item);
		}

		function findArray(data: unknown, targetPath: string): unknown[] | null {
			if (!data) return null;

			if (targetPath === '' || targetPath === 'auto') {
				const keys = ['list', 'data', 'items', 'results', 'elements', 'entities'];
				for (const key of keys) {
					if (data[key] && Array.isArray(data[key]) && data[key].length > 0) {
						const firstItem = data[key][0];
						if (firstItem && typeof firstItem === 'object') {
							for (const idField of fieldsToUse) {
								if (firstItem[idField] !== undefined) return data[key];
							}
						}
					}
				}

				function search(obj: unknown): unknown[] | null {
					if (!obj || typeof obj !== 'object') return null;
					if (Array.isArray(obj) && obj.length > 0) {
						const firstItem = obj[0];
						if (firstItem && typeof firstItem === 'object') {
							for (const idField of fieldsToUse) {
								if (firstItem[idField] !== undefined) return obj;
							}
						}
						return null;
					}
					for (const value of Object.values(obj as Record<string, unknown>)) {
						const result = search(value);
						if (result) return result;
					}
					return null;
				}
				return search(data);
			}

			const parts = targetPath.split('.');
			let current: unknown = data;
			for (const part of parts) {
				if (current === null || current === undefined) return null;
				if (typeof current !== 'object') return null;
				current = (current as Record<string, unknown>)[part];
			}
			return Array.isArray(current) ? current : null;
		}

		const arr1 = findArray(focused1, arrayPath);
		const arr2 = findArray(focused2, arrayPath);

		if (arr1 && arr2 && arr1.length > 0 && arr2.length > 0) {
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

			const allIds = new Set([...leftMap.keys(), ...rightMap.keys()]);
			const matched1: unknown[] = [];
			const matched2: unknown[] = [];

			for (const id of allIds) {
				const items1 = leftMap.get(id) || [];
				const items2 = rightMap.get(id) || [];
				const maxLen = Math.max(items1.length, items2.length);

				for (let i = 0; i < maxLen; i++) {
					matched1.push(items1[i] || null);
					matched2.push(items2[i] || null);
				}
			}

			sorted1 = [...matched1];
			sorted2 = [...matched2];
		} else {
			sorted1 = arr1 ? [...arr1] : null;
			sorted2 = arr2 ? [...arr2] : null;
		}
	}

	async function doSort() {
		if (sortEnabled) {
			sorted1 = null;
			sorted2 = null;
			sortEnabled = false;
			showSortModal = false;
			savedArrayPath = 'auto';
			savedIdField = 'auto';
			return;
		}

		sortLoading = true;
		showSortModal = false;

		await new Promise((r) => setTimeout(r, 0));

		savedArrayPath = selectedArrayPath;
		savedIdField = selectedIdField;

		applySorting(savedArrayPath, savedIdField);

		sortEnabled = true;
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

	<div class="relative">
		<button
			onclick={() => (showSortModal = !showSortModal)}
			class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all {sortEnabled
				? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400'
				: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'}"
			title="Sort arrays by ID to align matching items"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
				></path>
			</svg>
			{sortEnabled ? 'Reset Sort' : 'Sort Arrays'}
		</button>

		{#if showSortModal}
			<div
				class="absolute top-full right-0 z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-800"
			>
				<div class="mb-4 border-b border-gray-100 pb-3 dark:border-gray-700">
					<h3 class="text-sm font-semibold text-gray-800 dark:text-white">Sort Arrays by ID</h3>
					<p class="mt-0.5 text-xs text-gray-500">
						Align arrays from both servers by matching IDs for accurate comparison
					</p>
				</div>

				{#if detectedArrays.length === 0}
					<div class="py-4 text-center">
						<div class="mb-2 flex justify-center">
							<svg
								class="h-8 w-8 text-gray-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
								></path>
							</svg>
						</div>
						<p class="text-sm text-gray-500">No sortable arrays detected</p>
					</div>
				{:else}
					<div class="space-y-4">
						<div>
							<label class="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
								Select Array to Sort
							</label>
							<select
								bind:value={selectedArrayPath}
								class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
							>
								<option value="auto">Auto-detect best array</option>
								{#each detectedArrays as arr (arr.path)}
									<option value={arr.path}>
										{arr.pathLabel} ({arr.count} items{#if arr.detectedIdField}
											- {arr.detectedIdField}{/if})
									</option>
								{/each}
							</select>
						</div>

						<div>
							<label class="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
								Sort by ID Field
							</label>
							<div
								class="max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700"
							>
								{#each ID_FIELDS as field (field.value)}
									<label
										class="flex cursor-pointer items-start gap-2 border-b border-gray-100 px-3 py-2 last:border-b-0 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50 {selectedIdField ===
										field.value
											? 'bg-indigo-50 dark:bg-indigo-900/20'
											: ''}"
									>
										<input
											type="radio"
											name="idField"
											value={field.value}
											bind:group={selectedIdField}
											class="mt-0.5 h-3.5 w-3.5 accent-indigo-600"
										/>
										<div class="flex-1">
											<span class="text-sm font-medium text-gray-700 dark:text-gray-200"
												>{field.label}</span
											>
											<span class="ml-1.5 text-xs text-gray-400">{field.desc}</span>
										</div>
									</label>
								{/each}
							</div>
						</div>

						<div class="flex gap-2 pt-2">
							<button
								onclick={() => (showSortModal = false)}
								class="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700"
							>
								Cancel
							</button>
							<button
								onclick={doSort}
								disabled={sortLoading}
								class="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
							>
								{#if sortLoading}
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
											d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
										></path>
									</svg>
								{/if}
								Sort Now
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>

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

{#if showSortModal}
	<button
		class="fixed inset-0 z-40 cursor-default"
		onclick={() => (showSortModal = false)}
		aria-label="Close modal"
	></button>
{/if}

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
