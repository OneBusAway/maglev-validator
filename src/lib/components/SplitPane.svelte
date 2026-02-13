<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		left: Snippet;
		right: Snippet;
		initialSplit?: number;
		minLeft?: number;
		minRight?: number;
		splitPosition?: number;
	}

	let {
		left,
		right,
		initialSplit = 50,
		minLeft = 15,
		minRight = 15,
		splitPosition = $bindable(initialSplit)
	}: Props = $props();

	let container: HTMLDivElement | null = $state(null);
	let isDragging = $state(false);

	export function resetSplit() {
		splitPosition = initialSplit;
	}

	function handleMouseDown(e: MouseEvent) {
		isDragging = true;
		e.preventDefault();
		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging || !container) return;

		const rect = container.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const percentage = (x / rect.width) * 100;

		if (percentage >= minLeft && percentage <= 100 - minRight) {
			splitPosition = percentage;
		}
	}

	function handleMouseUp() {
		isDragging = false;
		window.removeEventListener('mousemove', handleMouseMove);
		window.removeEventListener('mouseup', handleMouseUp);
	}
</script>

<div bind:this={container} class="flex h-full w-full overflow-hidden rounded-xl">
	<div class="h-full min-w-0 overflow-hidden" style="width: {splitPosition}%">
		{@render left()}
	</div>

	<div
		class="flex w-4 shrink-0 cursor-col-resize items-center justify-center bg-gray-200 transition-colors hover:bg-indigo-400 dark:bg-gray-800 dark:hover:bg-indigo-600"
		class:!bg-indigo-500={isDragging}
		onmousedown={handleMouseDown}
		role="separator"
		aria-label="Resize panels"
	>
		<div class="flex flex-col gap-1">
			<div class="h-1 w-1 rounded-full bg-gray-400 dark:bg-gray-600"></div>
			<div class="h-1 w-1 rounded-full bg-gray-400 dark:bg-gray-600"></div>
			<div class="h-1 w-1 rounded-full bg-gray-400 dark:bg-gray-600"></div>
		</div>
	</div>

	<div class="h-full min-w-0 flex-1 overflow-hidden">
		{@render right()}
	</div>
</div>

<style>
	div[style*='width'] {
		transition: none;
	}
</style>
