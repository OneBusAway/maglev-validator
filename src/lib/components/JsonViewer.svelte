<script lang="ts">
	import JsonTree from './JsonTree.svelte';

	interface Props {
		data: unknown;
		otherData?: unknown;
		focusPath?: string;
		ignoredKeys?: string[];
		mode?: 'server1' | 'server2';
	}

	let { data, otherData, ignoredKeys = [], mode = 'server1' }: Props = $props();

	let globalExpand = $state<boolean | null>(null);
	let copied = $state(false);

	function expandAll() {
		globalExpand = true;
	}

	function collapseAll() {
		globalExpand = false;
	}

	async function copyJson() {
		try {
			await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy JSON:', err);
		}
	}
</script>

<div class="h-full bg-white font-sans text-sm dark:bg-gray-900">
	{#if data !== undefined}
		<div
			class="flex items-center justify-end gap-2 border-b border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-900"
		>
			<button
				onclick={copyJson}
				class="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
				title="Copy JSON to clipboard"
			>
				{#if copied}
					<svg
						class="h-3.5 w-3.5 text-green-600 dark:text-green-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 13l4 4L19 7"
						></path></svg
					>
					Copied!
				{:else}
					<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
						></path></svg
					>
					Copy
				{/if}
			</button>
			<button
				onclick={expandAll}
				class="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-100 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
				title="Expand all nodes"
			>
				<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
					><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"
					></path></svg
				>
				Expand All
			</button>
			<button
				onclick={collapseAll}
				class="flex items-center gap-1.5 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-700 transition-colors hover:bg-yellow-100 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50"
				title="Collapse all nodes"
			>
				<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
					><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"
					></path></svg
				>
				Collapse All
			</button>
		</div>
	{/if}
	<div class="min-h-full p-4 font-mono">
		{#if data !== undefined}
			<JsonTree
				value={data}
				otherValue={otherData}
				side={mode === 'server1' ? 'left' : 'right'}
				isReference={mode === 'server2'}
				{ignoredKeys}
				level={0}
				{globalExpand}
			/>
		{:else}
			<div class="py-8 text-center text-gray-400 italic">No JSON data</div>
		{/if}
	</div>
</div>
