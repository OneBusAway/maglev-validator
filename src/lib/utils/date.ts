/**
 * Formats a timestamp (seconds or milliseconds) into a readable date string.
 * Returns an object with multiple formats.
 */
export function formatTimestamp(
	input: string | number,
	now: number = Date.now()
): {
	original: string | number;
	isValid: boolean;
	local?: string;
	utc?: string;
	relative?: string;
	serviceDay?: string;
	isSeconds?: boolean;
} {
	let num = Number(input);
	if (isNaN(num)) {
		return { original: input, isValid: false };
	}

	// Heuristic: if less than 10 billion, it's probably seconds (valid until 2286)
	// If it's 10 digits, it's seconds. If 13 digits, milliseconds.
	let isSeconds = false;
	if (num < 10000000000) {
		num *= 1000;
		isSeconds = true;
	}

	const date = new Date(num);
	if (isNaN(date.getTime())) {
		return { original: input, isValid: false };
	}

	const localParams: Intl.DateTimeFormatOptions = {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	};

	const timeZone: string | undefined =
		typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;
	const local = date.toLocaleString('en-US', { ...localParams, timeZone });
	const utc = date
		.toISOString()
		.replace('T', ' ')
		.replace(/\.\d+Z$/, ' UTC');

	// Service day logic: if hour is 00-03, it might be 24-27 of previous day
	let serviceDay: string | undefined;
	const hour = date.getHours();
	if (hour < 4) {
		const prevDate = new Date(num - 24 * 60 * 60 * 1000);
		const prevDateStr = prevDate.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			timeZone
		});
		const serviceHour = hour + 24;
		const minutes = date.getMinutes().toString().padStart(2, '0');
		const seconds = date.getSeconds().toString().padStart(2, '0');
		serviceDay = `${prevDateStr} ${serviceHour}:${minutes}:${seconds} (Service Date)`;
	}

	// Relative time
	const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
	const diffMs = num - now;
	const diffSec = Math.round(diffMs / 1000);
	const diffMin = Math.round(diffSec / 60);
	const diffHour = Math.round(diffMin / 60);
	const diffDay = Math.round(diffHour / 24);

	let relative = '';
	if (Math.abs(diffSec) < 60) relative = rtf.format(diffSec, 'second');
	else if (Math.abs(diffMin) < 60) relative = rtf.format(diffMin, 'minute');
	else if (Math.abs(diffHour) < 24) relative = rtf.format(diffHour, 'hour');
	else relative = rtf.format(diffDay, 'day');

	return {
		original: input,
		isValid: true,
		local,
		utc,
		relative,
		serviceDay,
		isSeconds
	};
}
