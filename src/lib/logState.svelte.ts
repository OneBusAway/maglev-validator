export class LogState {
	lastUpdated = $state(0);

	triggerUpdate() {
		this.lastUpdated = Date.now();
	}
}

export const logState = new LogState();
