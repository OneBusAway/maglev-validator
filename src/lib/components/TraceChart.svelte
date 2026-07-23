<script lang="ts" module>
	export interface TraceSeries {
		label: string;
		points: { x: number; y: number }[];
	}
	export interface TraceEntry {
		timestamp: string;
	}
</script>

<script lang="ts">
	interface Props {
		series: TraceSeries[];
		entries: TraceEntry[];
		colors: string[];
		minVal: number;
		maxVal: number;
		range: number;
		title: string;
		accentClass: string;
		selectedLine?: number | null;
		onrefresh?: () => void;
	}

	let {
		series,
		entries,
		colors,
		minVal,
		range,
		title,
		accentClass,
		selectedLine = $bindable<number | null>(null),
		onrefresh
	}: Props = $props();

	// unique, id-safe suffix for gradient/clip ids (space broke url() refs before)
	const randSuffix = Math.random().toString(36).slice(2, 7);
	const uid = $derived(title.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + randSuffix);

	const pad = { top: 24, right: 18, bottom: 30, left: 46 };
	const cw = 420;
	const ch = 240;
	const iw = cw - pad.left - pad.right;
	const ih = ch - pad.top - pad.bottom;

	// view window in entry-index space
	let viewLo = $state(0);
	let viewHi = $state(0);

	// Initialize the view once when data first appears; never reset on subsequent
	// appends (that would discard the user's zoom/pan and cause flicker).
	let prevLen = 0;
	$effect(() => {
		const n = Math.max(entries.length - 1, 0);
		if (prevLen === 0 && n > 0) {
			viewLo = 0;
			viewHi = n;
		} else if (entries.length === 0) {
			viewLo = 0;
			viewHi = 0;
		}
		// when at full view and data grows, follow the new tail
		if (viewLo <= 1e-6 && viewHi >= prevLen - 1 - 1e-6 && n > viewHi) {
			viewHi = n;
		}
		prevLen = entries.length;
	});

	const span = $derived(Math.max(viewHi - viewLo, 1e-6));

	// "Nice" Y axis: round min/max out to human-friendly numbers (1, 2, 5 × 10^n)
	// and pick a clean step so ticks read like -50, -45, … 75, 80 instead of
	// raw data-driven decimals. Auto-rescales to the visible data when zoomed
	// so zooming in shows accurate Y detail.
	function niceNum(rangeVal: number, round: boolean): number {
		const exp = Math.floor(Math.log10(rangeVal || 1));
		const f = rangeVal / Math.pow(10, exp);
		let nf: number;
		if (round) {
			if (f < 1.5) nf = 1;
			else if (f < 3) nf = 2;
			else if (f < 7) nf = 5;
			else nf = 10;
		} else {
			if (f <= 1) nf = 1;
			else if (f <= 2) nf = 2;
			else if (f <= 5) nf = 5;
			else nf = 10;
		}
		return nf * Math.pow(10, exp);
	}

	const yAxis = $derived.by(() => {
		// gather Y values from visible points within the current zoom window
		let lo = Infinity;
		let hi = -Infinity;
		for (const { s } of activeSeries) {
			for (const pt of s.points) {
				if (pt.x < viewLo - 1 || pt.x > viewHi + 1) continue;
				if (pt.y < lo) lo = pt.y;
				if (pt.y > hi) hi = pt.y;
			}
		}
		if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
			lo = minVal;
			hi = minVal + (range || 1);
		}
		if (lo === hi) {
			lo -= 1;
			hi += 1;
		}
		const tickCount = 5;
		const rawRange = hi - lo || 1;
		const niceRange = niceNum(rawRange, false);
		const step = niceNum(niceRange / (tickCount - 1), true);
		const niceMin = Math.floor(lo / step) * step;
		const niceMax = Math.ceil(hi / step) * step;
		const ticks: number[] = [];
		for (let v = niceMin; v <= niceMax + step * 1e-6; v += step) {
			ticks.push(Math.abs(v) < step * 1e-6 ? 0 : v);
		}
		const niceRealRange = niceMax - niceMin || 1;
		return { ticks, niceMin, niceMax, niceRealRange };
	});

	const scaleY = (v: number) =>
		pad.top + ih - ((v - yAxis.niceMin) / (yAxis.niceRealRange || 1)) * ih;
	const scaleX = (ei: number) => pad.left + ((ei - viewLo) / span) * iw;

	const yTicks = $derived(yAxis.ticks.map((value) => ({ value, y: scaleY(value) })));

	// smart number formatter: keep integers clean, trim trailing zeros for
	// small decimals, compact large numbers (1234 -> 1.2k, 2000000 -> 2M).
	function fmt(v: number): string {
		const abs = Math.abs(v);
		if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
		if (abs >= 10_000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
		if (abs >= 1000) return v.toFixed(0);
		if (Number.isInteger(v)) return v.toString();
		if (abs >= 10) return v.toFixed(1);
		if (abs >= 1) return v.toFixed(2);
		return v.toFixed(3);
	}

	const xTicks = $derived.by(() => {
		const n = 5;
		const out: { label: string; x: number; ei: number }[] = [];
		for (let i = 0; i <= n; i++) {
			const ei = viewLo + (span * i) / n;
			out.push({ ei, x: scaleX(ei), label: Math.round(ei).toString() });
		}
		return out;
	});

	// selection model: selectedLine === null => all visible; otherwise only that line
	const effVisible = $derived(
		series.map((_, i) => (selectedLine === null ? true : i === selectedLine))
	);
	const activeSeries = $derived(series.map((s, i) => ({ s, i })).filter(({ i }) => effVisible[i]));

	function selectLine(i: number) {
		selectedLine = selectedLine === i ? null : i;
	}

	function showAll() {
		selectedLine = null;
	}

	// zoom helpers
	function zoomAt(centerEi: number, factor: number) {
		const n = Math.max(entries.length - 1, 0);
		const minSpan = n > 0 ? 1 : 0;
		const maxSpan = n;
		let newSpan = Math.min(Math.max(span / factor, minSpan), maxSpan);
		let lo = centerEi - (newSpan * (centerEi - viewLo)) / span;
		let hi = lo + newSpan;
		if (lo < 0) {
			hi -= lo;
			lo = 0;
		}
		if (hi > n) {
			lo -= hi - n;
			hi = n;
		}
		if (lo < 0) lo = 0;
		if (n === 0) {
			lo = 0;
			hi = 0;
		}
		viewLo = lo;
		viewHi = hi;
	}

	function zoomButton(factor: number) {
		zoomAt((viewLo + viewHi) / 2, factor);
	}

	function resetView() {
		const n = Math.max(entries.length - 1, 0);
		viewLo = 0;
		viewHi = n;
	}

	const isZoomed = $derived(span < Math.max(entries.length - 1, 0) - 1e-6);

	// wheel zoom
	function onWheel(e: WheelEvent) {
		e.preventDefault();
		if (!svgEl) return;
		const rect = svgEl.getBoundingClientRect();
		const px = ((e.clientX - rect.left) / rect.width) * cw;
		const ei = viewLo + ((px - pad.left) / iw) * span;
		zoomAt(ei, e.deltaY > 0 ? 1 / 1.2 : 1.2);
	}

	// pan
	let dragging = $state(false);
	let moved = $state(false);
	let dragStartX = 0;
	let dragStartLo = 0;
	let dragStartHi = 0;

	function onPointerDown(e: PointerEvent) {
		dragging = true;
		moved = false;
		dragStartX = e.clientX;
		dragStartLo = viewLo;
		dragStartHi = viewHi;
		svgEl?.setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		updateHover(e);
		if (!dragging) return;
		const rect = svgEl!.getBoundingClientRect();
		const dxPx = ((e.clientX - dragStartX) / rect.width) * cw;
		if (Math.abs(e.clientX - dragStartX) > 3) moved = true;
		const dEi = (dxPx / iw) * span;
		const n = Math.max(entries.length - 1, 0);
		let lo = dragStartLo - dEi;
		let hi = dragStartHi - dEi;
		if (lo < 0) {
			hi -= lo;
			lo = 0;
		}
		if (hi > n) {
			lo -= hi - n;
			hi = n;
		}
		if (lo < 0) lo = 0;
		viewLo = lo;
		viewHi = hi;
	}

	function onPointerUp(e: PointerEvent) {
		dragging = false;
		try {
			svgEl?.releasePointerCapture(e.pointerId);
		} catch {
			// ignore
		}
	}

	// hover crosshair + tooltip — all reactive state
	let svgEl = $state<SVGSVGElement | null>(null);
	let crosshairPx = $state<number | null>(null);
	// Explicit hover data state (avoids derived chain issues)
	let hoverData = $state<{ x: number; value: number | null; delta: number | null }[]>([]);

	function updateHover(e: PointerEvent) {
		if (!svgEl) return;
		const rect = svgEl.getBoundingClientRect();
		const px = ((e.clientX - rect.left) / rect.width) * cw;
		if (px < pad.left || px > cw - pad.right) {
			crosshairPx = null;
			hoverData = [];
			return;
		}
		crosshairPx = px;
		const f = viewLo + ((px - pad.left) / iw) * span;
		hoverData = activeSeries.map(({ s }) => {
			if (!s || s.points.length === 0) {
				return { x: 0, value: null as number | null, delta: null as number | null };
			}
			let nearest = s.points[0];
			let bestDist = Math.abs(s.points[0].x - f);
			for (const pt of s.points) {
				const d = Math.abs(pt.x - f);
				if (d < bestDist) {
					bestDist = d;
					nearest = pt;
				}
			}
			const idx = s.points.indexOf(nearest);
			const value = nearest.y;
			const delta = idx > 0 ? value - s.points[idx - 1].y : null;
			return { x: nearest.x, value, delta };
		});
	}

	function clearHover() {
		crosshairPx = null;
		hoverData = [];
	}

	const tooltipLeft = $derived(crosshairPx !== null && crosshairPx > cw * 0.62);
	const tooltipLeftPct = $derived(crosshairPx !== null ? (crosshairPx / cw) * 100 : 0);

	// build a smooth path for a series (Catmull-Rom -> bezier)
	function smoothPath(pts: { x: number; y: number }[]): string {
		if (pts.length === 0) return '';
		if (pts.length === 1) return `M ${scaleX(pts[0].x)},${scaleY(pts[0].y)}`;
		let d = `M ${scaleX(pts[0].x)},${scaleY(pts[0].y)}`;
		for (let i = 0; i < pts.length - 1; i++) {
			const p0 = pts[i - 1] ?? pts[i];
			const p1 = pts[i];
			const p2 = pts[i + 1];
			const p3 = pts[i + 2] ?? p2;
			const c1x = scaleX(p1.x) + (scaleX(p2.x) - scaleX(p0.x)) / 6;
			const c1y = scaleY(p1.y) + (scaleY(p2.y) - scaleY(p0.y)) / 6;
			const c2x = scaleX(p2.x) - (scaleX(p3.x) - scaleX(p1.x)) / 6;
			const c2y = scaleY(p2.y) - (scaleY(p3.y) - scaleY(p1.y)) / 6;
			d += ` C ${c1x},${c1y} ${c2x},${c2y} ${scaleX(p2.x)},${scaleY(p2.y)}`;
		}
		return d;
	}

	// area path (line + baseline) for subtle gradient fill under the only visible series
	function areaPath(pts: { x: number; y: number }[]): string {
		if (pts.length === 0) return '';
		const line = smoothPath(pts);
		const baseline = scaleY(minVal);
		return `${line} L ${scaleX(pts[pts.length - 1].x)},${baseline} L ${scaleX(pts[0].x)},${baseline} Z`;
	}
</script>

<div class="flex h-full flex-col gap-2">
	<!-- header: title + controls -->
	<div class="flex items-start justify-between gap-3">
		<div class="flex items-center gap-2">
			<span class="inline-block h-2 w-2 rounded-full {accentClass} bg-current"></span>
			<h4 class="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h4>
			<span
				class="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400"
			>
				{activeSeries.length}/{series.length}
			</span>
		</div>
		<div class="flex items-center gap-1">
			<button
				type="button"
				onclick={() => zoomButton(1.6)}
				title="Zoom in"
				aria-label="Zoom in"
				class="grid h-7 w-7 place-items-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
			>
				<svg
					class="h-3.5 w-3.5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg
				>
			</button>
			<button
				type="button"
				onclick={() => zoomButton(1 / 1.6)}
				title="Zoom out"
				aria-label="Zoom out"
				class="grid h-7 w-7 place-items-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
			>
				<svg
					class="h-3.5 w-3.5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"><path d="M5 12h14" /></svg
				>
			</button>
			{#if isZoomed}
				<button
					type="button"
					onclick={resetView}
					title="Reset zoom"
					aria-label="Reset zoom"
					class="grid h-7 w-7 place-items-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
				>
					<svg
						class="h-3.5 w-3.5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.2"
						stroke-linecap="round"
						stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg
					>
				</button>
			{/if}
			{#if onrefresh}
				<button
					type="button"
					onclick={() => onrefresh()}
					title="Refresh chart data"
					aria-label="Refresh chart data"
					class="grid h-7 w-7 place-items-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
				>
					<svg
						class="h-3.5 w-3.5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path
							d="M21 3v5h-5"
						/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path
							d="M3 21v-5h5"
						/></svg
					>
				</button>
			{/if}
		</div>
	</div>

	<!-- chart -->
	<div class="relative flex-1">
		<svg
			bind:this={svgEl}
			viewBox="0 0 {cw} {ch}"
			class="w-full touch-none select-none {dragging && moved
				? 'cursor-grabbing'
				: 'cursor-crosshair'}"
			onwheel={onWheel}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
			onpointerleave={() => {
				clearHover();
				dragging = false;
			}}
		>
			<defs>
				{#each series as _, i (i)}
					<linearGradient id="line-{uid}-{i}" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color={colors[i % colors.length]} stop-opacity="0.16" />
						<stop offset="100%" stop-color={colors[i % colors.length]} stop-opacity="0" />
					</linearGradient>
				{/each}
				<clipPath id="clip-{uid}">
					<rect x={pad.left} y={pad.top - 6} width={iw} height={ih + 12} />
				</clipPath>
			</defs>

			<!-- horizontal grid -->
			{#each yTicks as tick (tick.value)}
				<line
					x1={pad.left}
					x2={cw - pad.right}
					y1={tick.y}
					y2={tick.y}
					stroke="currentColor"
					class="text-gray-100 dark:text-gray-800"
					stroke-width="1"
				/>
				<text
					x={pad.left - 6}
					y={tick.y + 3}
					text-anchor="end"
					class="fill-gray-400 text-[9px] tabular-nums dark:fill-gray-500"
				>
					{fmt(tick.value)}
				</text>
			{/each}

			<!-- x ticks -->
			{#each xTicks as tick (tick.ei)}
				<text
					x={tick.x}
					y={ch - pad.bottom + 14}
					text-anchor="middle"
					class="fill-gray-400 text-[8px] tabular-nums dark:fill-gray-500"
				>
					{tick.label}
				</text>
			{/each}

			<!-- series lines + data points -->
			<g clip-path="url(#clip-{uid})">
				{#each activeSeries as { s, i } (i)}
					{#if activeSeries.length === 1}
						<path d={areaPath(s.points)} fill="url(#line-{uid}-{i})" />
					{/if}
					<path
						d={smoothPath(s.points)}
						fill="none"
						stroke={colors[i % colors.length]}
						stroke-width="2.25"
						stroke-linejoin="round"
						stroke-linecap="round"
						style="transition: d 0.3s ease"
					/>
					{#each s.points as p (p.x)}
						<circle
							cx={scaleX(p.x)}
							cy={scaleY(p.y)}
							r="2.5"
							fill="white"
							stroke={colors[i % colors.length]}
							stroke-width="1.5"
							style="transition: cx 0.3s ease, cy 0.3s ease"
						/>
					{/each}
				{/each}
			</g>

			<!-- hover crosshair (follows mouse smoothly) -->
			{#if crosshairPx !== null}
				<line
					x1={crosshairPx}
					x2={crosshairPx}
					y1={pad.top - 4}
					y2={ch - pad.bottom}
					stroke="#94a3b8"
					stroke-width="1"
					stroke-dasharray="4,4"
				/>
				{#each activeSeries as { i }, ai (i)}
					{#if hoverData[ai]?.value !== null && hoverData[ai]?.value !== undefined}
						<circle
							cx={scaleX(hoverData[ai].x)}
							cy={scaleY(hoverData[ai].value)}
							r="4.5"
							fill={colors[i % colors.length]}
							stroke="white"
							stroke-width="2"
						/>
					{/if}
				{/each}
			{/if}
		</svg>

		<!-- floating tooltip card (no transition:fly — instant follow like trading apps) -->
		{#if crosshairPx !== null && hoverData.length > 0}
			<div
				class="pointer-events-none absolute top-0 z-20 min-w-[150px] rounded-xl border border-gray-200/80 bg-white/95 px-3 py-2 text-xs shadow-xl backdrop-blur-sm dark:border-gray-700/80 dark:bg-gray-900/95"
				style="left: {tooltipLeftPct}%; {tooltipLeft
					? 'transform: translateX(-110%)'
					: 'transform: translateX(14px)'}"
			>
				{#each activeSeries as { s, i }, ai (i)}
					<div class="flex items-center gap-2 py-0.5">
						<span class="h-2 w-2 rounded-full" style="background-color: {colors[i % colors.length]}"
						></span>
						<span class="font-mono text-[10px] text-gray-500 dark:text-gray-400">{s.label}</span>
						<span class="ml-auto text-right">
							<span class="font-semibold text-gray-800 tabular-nums dark:text-gray-100">
								{hoverData[ai]?.value !== null && hoverData[ai]?.value !== undefined
									? fmt(hoverData[ai].value)
									: '—'}
							</span>
							{#if hoverData[ai]?.delta !== null && hoverData[ai]?.delta !== undefined && hoverData[ai].delta !== 0}
								<span
									class="ml-1 text-[10px] font-medium {hoverData[ai].delta > 0
										? 'text-emerald-600 dark:text-emerald-400'
										: 'text-rose-600 dark:text-rose-400'}"
								>
									{hoverData[ai].delta > 0 ? '↑' : '↓'}{fmt(Math.abs(hoverData[ai].delta))}
								</span>
							{/if}
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- legend / line picker -->
	<div class="flex flex-wrap items-center gap-1.5">
		{#if selectedLine !== null}
			<button
				type="button"
				onclick={showAll}
				class="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-medium text-gray-600 shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
			>
				Show all
			</button>
		{/if}
		{#each series as s, i (i)}
			<button
				type="button"
				onclick={() => selectLine(i)}
				title={selectedLine === i ? 'Click to show all lines' : 'Click to view only this line'}
				class="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition
					{selectedLine === null
					? 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'
					: selectedLine === i
						? 'border-transparent text-white shadow-sm'
						: 'border-gray-200/60 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-600'}"
				style={selectedLine === i ? `background-color: ${colors[i % colors.length]}` : ''}
			>
				<span class="h-2 w-2 rounded-full" style="background-color: {colors[i % colors.length]}"
				></span>
				<span class="font-mono">{s.label}</span>
			</button>
		{/each}
	</div>
	{#if series.length > 1}
		<div class="text-[9px] text-gray-400 dark:text-gray-500">
			Tap a line to view it alone · scroll to zoom · drag to pan
		</div>
	{/if}
</div>
