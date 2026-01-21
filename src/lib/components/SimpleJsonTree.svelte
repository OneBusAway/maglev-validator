<script lang="ts">
	import SimpleJsonTree from './SimpleJsonTree.svelte';

	interface Props {
		value: unknown;
		level?: number;
		label?: string;
		globalExpand?: boolean | null;
		localExpand?: boolean | null;
	}

	let { value, level = 0, label, globalExpand = null, localExpand = null }: Props = $props();

	let manualExpanded = $state<boolean | null>(null);

	const expanded = $derived(
		manualExpanded !== null
			? manualExpanded
			: localExpand !== null
				? localExpand
				: globalExpand !== null
					? globalExpand
					: level === 0
	);

	let childLocalExpand = $state<boolean | null>(null);

	function expandAllChildren() {
		childLocalExpand = true;
	}

	function collapseAllChildren() {
		childLocalExpand = false;
		manualExpanded = false;
	}

	$effect(() => {
		if (globalExpand !== null) {
			childLocalExpand = null;
			manualExpanded = null;
		}
	});

	const childExpand = $derived(childLocalExpand !== null ? childLocalExpand : localExpand);

	function toggle() {
		manualExpanded = !expanded;
	}

	function isObject(val: unknown): val is Record<string, unknown> {
		return val !== null && typeof val === 'object' && !Array.isArray(val);
	}

	function isArray(val: unknown): val is unknown[] {
		return Array.isArray(val);
	}

	function formatPrimitive(val: unknown): string {
		if (val === null) return 'null';
		if (val === undefined) return 'undefined';
		if (typeof val === 'string') return `"${val}"`;
		return String(val);
	}

	function getValueColorClass(val: unknown): string {
		if (typeof val === 'string') return 'text-green-600 dark:text-green-400';
		if (typeof val === 'number') return 'text-blue-600 dark:text-blue-400';
		if (typeof val === 'boolean') return 'text-purple-600 dark:text-purple-400 font-semibold';
		if (val === null) return 'text-gray-500 dark:text-gray-400 italic';
		if (val === undefined) return 'text-gray-500 dark:text-gray-400 italic';
		return 'text-gray-900 dark:text-gray-100';
	}

	function getTypeInfo(val: unknown): string {
		if (isArray(val)) return `Array(${val.length})`;
		if (isObject(val)) return `Object{${Object.keys(val).length}}`;
		return '';
	}
</script>

<div class="font-mono text-[14px] leading-[1.8]">
	{#if label !== undefined}
		<div
			class="group flex items-center rounded py-0.5 hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
		>
			{#if isArray(value) || isObject(value)}
				<button
					onclick={toggle}
					class="mr-2 flex h-5 w-5 cursor-pointer items-center justify-center rounded text-[11px] text-gray-400 transition-all hover:bg-gray-200 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-200"
				>
					<span class="transition-transform {expanded ? 'rotate-0' : '-rotate-90'}">▼</span>
				</button>
			{:else}
				<span class="mr-2 inline-block w-5"></span>
			{/if}

			<span class="font-semibold text-cyan-700 dark:text-cyan-400">{label}</span>
			<span class="mx-1 text-gray-400 dark:text-gray-600">:</span>

			{#if isArray(value) || isObject(value)}
				<span
					class="ml-2 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400"
				>
					{getTypeInfo(value)}
				</span>
				{#if expanded && ((isArray(value) && value.length > 1) || (isObject(value) && Object.keys(value as Record<string, unknown>).length > 1))}
					<div class="ml-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
						<button
							onclick={(e) => {
								e.stopPropagation();
								expandAllChildren();
							}}
							class="flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
							title="Expand all items"
						>
							<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 9l-7 7-7-7"
								></path></svg
							>
							Expand
						</button>
						<button
							onclick={(e) => {
								e.stopPropagation();
								collapseAllChildren();
							}}
							class="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50"
							title="Collapse all items"
						>
							<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M5 15l7-7 7 7"
								></path></svg
							>
							Collapse
						</button>
					</div>
				{/if}
			{:else}
				<span class="ml-2 {getValueColorClass(value)}">{formatPrimitive(value)}</span>
			{/if}
		</div>

		{#if expanded && isObject(value)}
			<div class="ml-3 border-l-2 border-gray-200 pl-4 dark:border-gray-700">
				{#each Object.entries(value) as [key, val] (key)}
					<SimpleJsonTree
						value={val}
						level={level + 1}
						label={key}
						{globalExpand}
						localExpand={childExpand}
					/>
				{/each}
			</div>
		{/if}

		{#if expanded && isArray(value)}
			<div class="ml-3 border-l-2 border-gray-200 pl-4 dark:border-gray-700">
				{#each value as item, index (index)}
					<SimpleJsonTree
						value={item}
						level={level + 1}
						label={String(index)}
						{globalExpand}
						localExpand={childExpand}
					/>
				{/each}
			</div>
		{/if}
	{:else if isObject(value)}
		<div>
			{#each Object.entries(value) as [key, val] (key)}
				<SimpleJsonTree
					value={val}
					level={level + 1}
					label={key}
					{globalExpand}
					localExpand={childExpand}
				/>
			{/each}
		</div>
	{:else if isArray(value)}
		<div>
			{#each value as item, index (index)}
				<SimpleJsonTree
					value={item}
					level={level + 1}
					label={String(index)}
					{globalExpand}
					localExpand={childExpand}
				/>
			{/each}
		</div>
	{:else}
		<span class={getValueColorClass(value)}>{formatPrimitive(value)}</span>
	{/if}
</div>
