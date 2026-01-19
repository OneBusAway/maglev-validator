<script lang="ts">
	import SimpleJsonTree from './SimpleJsonTree.svelte';

	interface Props {
		value: unknown;
		level?: number;
		label?: string;
	}

	let { value, level = 0, label }: Props = $props();
	let expanded = $state(true);

	$effect(() => {
		if (level >= 3) {
			expanded = false;
		}
	});

	function toggle() {
		expanded = !expanded;
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
		if (val === null) return 'text-slate-500 dark:text-slate-400 italic';
		if (val === undefined) return 'text-slate-500 dark:text-slate-400 italic';
		return 'text-slate-900 dark:text-slate-100';
	}

	function getTypeInfo(val: unknown): string {
		if (isArray(val)) return `Array(${val.length})`;
		if (isObject(val)) return `Object{${Object.keys(val).length}}`;
		return '';
	}
</script>

<div class="font-mono text-[13px] leading-relaxed">
	{#if label !== undefined}
		<div class="flex items-start">
			{#if isArray(value) || isObject(value)}
				<button
					onclick={toggle}
					class="mr-1 flex h-5 w-5 cursor-pointer items-center justify-center text-[10px] text-slate-500 select-none hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
				>
					{expanded ? '▼' : '▶'}
				</button>
			{:else}
				<span class="mr-1 inline-block w-5"></span>
			{/if}

			<span class="font-medium text-slate-700 dark:text-slate-300">{label}</span>
			<span class="text-slate-400 dark:text-slate-500">:</span>

			{#if isArray(value) || isObject(value)}
				<span class="ml-2 text-xs text-slate-400 dark:text-slate-500">
					{getTypeInfo(value)}
				</span>
			{:else}
				<span class="ml-2 {getValueColorClass(value)}">{formatPrimitive(value)}</span>
			{/if}
		</div>
	{/if}

	{#if expanded && isObject(value)}
		<div class="ml-4 border-l border-slate-200 pl-3 dark:border-slate-700">
			{#each Object.entries(value) as [key, val] (key)}
				<SimpleJsonTree value={val} level={level + 1} label={key} />
			{/each}
		</div>
	{/if}

	{#if expanded && isArray(value)}
		<div class="ml-4 border-l border-slate-200 pl-3 dark:border-slate-700">
			{#each value as item, index (index)}
				<SimpleJsonTree value={item} level={level + 1} label={String(index)} />
			{/each}
		</div>
	{/if}

	{#if label === undefined && !isObject(value) && !isArray(value)}
		<span class={getValueColorClass(value)}>{formatPrimitive(value)}</span>
	{/if}

	{#if label === undefined && (isObject(value) || isArray(value))}
		{#if isObject(value)}
			<div>
				{#each Object.entries(value) as [key, val] (key)}
					<SimpleJsonTree value={val} level={level + 1} label={key} />
				{/each}
			</div>
		{:else if isArray(value)}
			<div>
				{#each value as item, index (index)}
					<SimpleJsonTree value={item} level={level + 1} label={String(index)} />
				{/each}
			</div>
		{/if}
	{/if}
</div>
