<script lang="ts">
	import JsonTree from './JsonTree.svelte';
	import {
		countDifferences,
		getDiffStatus,
		isArray,
		isObject,
		isPrimitive,
		sortArrayValues,
		sortEntries
	} from '$lib/utils/jsonCompare';

	interface Props {
		value: unknown;
		otherValue: unknown;
		side: 'left' | 'right';
		label?: string;
		level?: number;
		isReference?: boolean;
		ignoredKeys?: string[];
		globalExpand?: boolean | null;
		localExpand?: boolean | null;
	}

	let {
		value,
		otherValue,
		side,
		label,
		level = 0,
		isReference = false,
		ignoredKeys = [],
		globalExpand = null,
		localExpand = null
	}: Props = $props();

	let manualExpanded = $state<boolean | null>(null);

	const expanded = $derived(
		level === 0
			? true
			: manualExpanded !== null
				? manualExpanded
				: localExpand !== null
					? localExpand
					: globalExpand !== null
						? globalExpand
						: false
	);

	const status = $derived(getDiffStatus(value, otherValue, side, ignoredKeys));
	const hasDiff = $derived(status !== 'same' && !isReference);
	const diffCount = $derived(countDifferences(value, otherValue, ignoredKeys));
	const arrayItems = $derived(isArray(value) ? sortArrayValues(value) : []);
	const otherArrayItems = $derived(isArray(otherValue) ? sortArrayValues(otherValue) : []);

	const otherValueFormatted = $derived(() => {
		if (isPrimitive(otherValue)) {
			return formatPrimitive(otherValue);
		}
		if (otherValue === undefined) {
			return 'missing';
		}
		return 'different';
	});

	function toggle() {
		manualExpanded = !expanded;
	}

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

	function formatPrimitive(val: unknown): string {
		if (val === null) return 'null';
		if (val === undefined) return 'undefined';
		if (typeof val === 'string') return `"${val}"`;
		return String(val);
	}

	function getValueColorClass(val: unknown): string {
		if (typeof val === 'string') return 'text-green-600 dark:text-green-400';
		if (typeof val === 'number') return 'text-blue-600 dark:text-blue-400';
		if (typeof val === 'boolean') return 'text-blue-600 dark:text-blue-400 font-bold';
		if (val === null) return 'text-gray-500 dark:text-gray-400 italic';
		if (val === undefined) return 'text-gray-500 dark:text-gray-400 italic';
		return 'text-gray-900 dark:text-gray-100';
	}

	function getDiffClass(): string {
		if (isReference || status === 'same') return '';
		if (status === 'different')
			return 'bg-[#f8f8f8] dark:bg-gray-800/50 outline outline-1 outline-[#e0e0e0] dark:outline-gray-700'; // Very subtle gray bg
		return '';
	}

	function getDiffIndicator(): string {
		if (isReference || status === 'same') return '';
		if (status === 'different') return 'text-red-600 bg-red-50 border border-red-200';
		if (status === 'missing') return 'text-orange-600 bg-orange-50 border border-orange-200';
		if (status === 'added') return 'text-green-600 bg-green-50 border border-green-200';
		if (status === 'different')
			return 'text-red-600 bg-red-50 border border-red-200 dark:text-red-400 dark:bg-red-900/30 dark:border-red-700';
		if (status === 'missing')
			return 'text-orange-600 bg-orange-50 border border-orange-200 dark:text-orange-400 dark:bg-orange-900/30 dark:border-orange-700';
		if (status === 'added')
			return 'text-green-600 bg-green-50 border border-green-200 dark:text-green-400 dark:bg-green-900/30 dark:border-green-700';
		return '';
	}
</script>

<div class="font-sans text-[14px] leading-[1.8] tracking-wide">
	{#if label !== undefined}
		<div
			class="group -mx-1 flex items-center rounded px-1 py-0.5 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 {getDiffClass()}"
		>
			{#if isArray(value) || isObject(value)}
				<button
					onclick={toggle}
					class="mr-2 flex h-5 w-5 cursor-pointer items-center justify-center rounded text-[11px] text-gray-400 transition-all hover:bg-gray-200 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-200"
				>
					<span class="transition-transform {expanded ? 'rotate-0' : '-rotate-90'}">▼</span>
				</button>
			{:else}
				<span class="mr-2 w-5 flex-shrink-0"></span>
			{/if}

			<span class="mr-1 flex-shrink-0 font-semibold text-cyan-700 select-text dark:text-cyan-400">
				{label}<span class="text-gray-400 dark:text-gray-600">:</span>
			</span>

			{#if isPrimitive(value)}
				<span class="{getValueColorClass(value)} font-mono select-text">
					{formatPrimitive(value)}
				</span>

				{#if hasDiff}
					<span
						class="ml-3 rounded px-1.5 py-0.5 text-[11px] {getDiffIndicator()} whitespace-nowrap select-none"
					>
						{#if status === 'different'}
							!= {otherValueFormatted()}
						{:else if status === 'missing'}
							missing
						{:else if status === 'added'}
							extra
						{/if}
					</span>
				{/if}
			{:else}
				<span
					class="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 select-text dark:bg-gray-800 dark:text-gray-400"
				>
					{isArray(value)
						? `Array[${value.length}]`
						: `Object{${Object.keys(value as Record<string, unknown>).length}}`}
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
				{#if !expanded && diffCount > 0 && !isReference}
					<span
						class="ml-2 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
					>
						{diffCount} diff{diffCount > 1 ? 's' : ''}
					</span>
				{/if}
			{/if}
		</div>
	{/if}

	{#if expanded}
		<div
			class={label !== undefined ? 'ml-4 border-l-2 border-gray-200 pl-4 dark:border-gray-700' : ''}
		>
			{#if isArray(value)}
				{#each arrayItems as item, index (index)}
					{@const otherItem = otherArrayItems[index]}
					<JsonTree
						value={item}
						otherValue={otherItem}
						label={String(index)}
						{side}
						level={level + 1}
						{isReference}
						{ignoredKeys}
						{globalExpand}
						localExpand={childExpand}
					/>
				{/each}
			{:else if isObject(value)}
				{#each sortEntries(value as Record<string, unknown>) as [key, childValue] (key)}
					{#if !ignoredKeys.includes(key)}
						<JsonTree
							value={childValue}
							otherValue={isObject(otherValue)
								? (otherValue as Record<string, unknown>)[key]
								: undefined}
							label={key}
							{side}
							level={level + 1}
							{isReference}
							{ignoredKeys}
							{globalExpand}
							localExpand={childExpand}
						/>
					{/if}
				{/each}
			{/if}
		</div>
	{:else if !label && isPrimitive(value)}
		<span class="{getValueColorClass(value)} rounded px-1 select-text">
			{formatPrimitive(value)}
		</span>
	{/if}
</div>
