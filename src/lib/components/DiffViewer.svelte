<script lang="ts">
	import JsonViewer from './JsonViewer.svelte';
	import { getByPath } from '$lib/utils/jsonCompare';

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
</script>

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
		<JsonViewer data={focused1} otherData={focused2} {focusPath} {ignoredKeys} mode="server1" />
	</div>
	<div
		class="max-h-[800px] overflow-auto border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
	>
		<JsonViewer data={focused2} otherData={focused1} {focusPath} {ignoredKeys} mode="server2" />
	</div>
</div>
