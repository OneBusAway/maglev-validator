<script lang="ts">
	import JsonDiff from './JsonDiff.svelte';

	interface Props {
		json: unknown;
		otherJson: unknown;
		side: 'left' | 'right';
		indent?: number;
	}

	let { json, otherJson, side, indent = 0 }: Props = $props();

	function getDiffStatus(
		key: string,
		value: unknown,
		other: unknown
	): 'same' | 'different' | 'missing' | 'added' {
		if (other === null || other === undefined) {
			return side === 'left' ? 'missing' : 'added';
		}

		if (typeof other === 'object' && other !== null) {
			if (!(key in other)) {
				return side === 'left' ? 'missing' : 'added';
			}
			const otherValue = (other as Record<string, unknown>)[key];
			if (JSON.stringify(value) === JSON.stringify(otherValue)) {
				return 'same';
			}
			return 'different';
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if (!(key in (other as any))) {
			return side === 'left' ? 'missing' : 'added';
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return (other as any)[key] === value ? 'same' : 'different';
	}

	function getValueDiffStatus(
		value: unknown,
		otherValue: unknown
	): 'same' | 'different' | 'missing' | 'added' {
		if (otherValue === null || otherValue === undefined) {
			return side === 'left' ? 'missing' : 'added';
		}

		if (JSON.stringify(value) === JSON.stringify(otherValue)) {
			return 'same';
		}

		return 'different';
	}

	function formatValue(value: unknown): string {
		if (value === null) return 'null';
		if (value === undefined) return 'undefined';
		if (typeof value === 'string') return `"${value}"`;
		return String(value);
	}

	function isObject(value: unknown): value is Record<string, unknown> {
		return typeof value === 'object' && value !== null && !Array.isArray(value);
	}

	function isArray(value: unknown): value is unknown[] {
		return Array.isArray(value);
	}

	function isPrimitive(value: unknown): boolean {
		return !isObject(value) && !isArray(value);
	}
</script>

{#if json === null || json === undefined}
	<div class="font-mono text-sm text-gray-500 italic">null</div>
{:else if isPrimitive(json)}
	{@const status = getValueDiffStatus(json, otherJson)}
	<span
		class:bg-yellow-200={status === 'different'}
		class:bg-red-200={status === 'missing' && side === 'right'}
		class:bg-green-200={status === 'added' && side === 'left'}
		class:text-green-800={typeof json === 'string'}
		class:text-blue-700={typeof json === 'number'}
		class:text-purple-700={typeof json === 'boolean'}
		class="rounded px-1.5 py-0.5 font-mono text-sm font-medium"
	>
		{formatValue(json)}
	</span>
{:else if isArray(json)}
	<div class="font-mono text-sm">
		<div class="font-bold text-gray-600">[</div>
		{#each json as item, i (i)}
			{@const otherItem = (otherJson as unknown[])?.[i]}
			{@const status = getValueDiffStatus(item, otherItem)}
			<div
				class="ml-6 border-l-2 border-gray-300 py-1 pl-3"
				class:bg-yellow-100={status === 'different'}
				class:bg-red-100={status === 'missing' && side === 'right'}
				class:bg-green-100={status === 'added' && side === 'left'}
				class:border-yellow-400={status === 'different'}
				class:border-red-400={status === 'missing' && side === 'right'}
				class:border-green-400={status === 'added' && side === 'left'}
			>
				{#if isPrimitive(item)}
					<span class="rounded px-1">{formatValue(item)}</span><span class="text-gray-500"
						>{i < json.length - 1 ? ',' : ''}</span
					>
				{:else}
					<JsonDiff json={item} otherJson={otherItem} {side} indent={indent + 1} />
					<span class="text-gray-500">{i < json.length - 1 ? ',' : ''}</span>
				{/if}
			</div>
		{/each}
		<div class="font-bold text-gray-600">]</div>
	</div>
{:else if isObject(json)}
	<div class="font-mono text-sm">
		{#if indent === 0}
			<div class="mb-2 text-base font-bold text-gray-600">&#123;</div>
		{/if}
		{#each Object.entries(json) as [key, value], i (key)}
			{@const otherValue = (otherJson as Record<string, unknown>)?.[key]}
			{@const status = getDiffStatus(key, value, otherJson)}
			<div
				class="ml-6 rounded-sm border-l-2 py-1.5 pl-4"
				class:bg-yellow-50={status === 'different'}
				class:bg-red-50={status === 'missing' && side === 'right'}
				class:bg-green-50={status === 'added' && side === 'left'}
				class:border-yellow-400={status === 'different'}
				class:border-red-400={status === 'missing' && side === 'right'}
				class:border-green-400={status === 'added' && side === 'left'}
				class:border-gray-200={status === 'same'}
			>
				<span class="font-bold text-green-700">"{key}"</span><span class="mx-1 text-gray-500"
					>:</span
				>
				{#if isPrimitive(value)}
					<span class="px-1">{formatValue(value)}</span><span class="text-gray-400"
						>{i < Object.entries(json).length - 1 ? ',' : ''}</span
					>
				{:else if isArray(value)}
					<div class="mt-1">
						<JsonDiff json={value} otherJson={otherValue} {side} indent={indent + 1} />
					</div>
					<span class="text-gray-400">{i < Object.entries(json).length - 1 ? ',' : ''}</span>
				{:else if isObject(value)}
					<div class="mt-1">
						<div class="font-bold text-gray-600">&#123;</div>
						<div class="ml-2">
							<JsonDiff json={value} otherJson={otherValue} {side} indent={indent + 1} />
						</div>
						<div class="font-bold text-gray-600">&#125;</div>
					</div>
					<span class="text-gray-400">{i < Object.entries(json).length - 1 ? ',' : ''}</span>
				{/if}
			</div>
		{/each}
		{#if indent === 0}
			<div class="mt-2 text-base font-bold text-gray-600">&#125;</div>
		{/if}
	</div>
{/if}
