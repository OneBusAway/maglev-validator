<script lang="ts">
	import JsonViewer from './JsonViewer.svelte';
	import { getByPath } from '$lib/utils/jsonCompare';
	import { deepSearchJSON } from '$lib/utils/search';
	import { SvelteSet } from 'svelte/reactivity';

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

	<div class="max-h-[800px] overflow-auto bg-white dark:bg-gray-900">
		<JsonViewer
			data={focused1}
			otherData={focused2}
			{focusPath}
			{ignoredKeys}
			mode="server1"
			searchQuery={debouncedSearchQuery}
			matchingPaths={matchingPaths1}
		/>
	</div>
	<div
		class="max-h-[800px] overflow-auto border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
	>
		<JsonViewer
			data={focused2}
			otherData={focused1}
			{focusPath}
			{ignoredKeys}
			mode="server2"
			searchQuery={debouncedSearchQuery}
			matchingPaths={matchingPaths2}
		/>
	</div>
</div>
