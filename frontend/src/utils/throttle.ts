/**
 * Creates a throttled version of a function that limits how often it can be called
 */
// biome-ignore lint/suspicious/noExplicitAny: Generic function type requires any
export function throttle<T extends (...args: any[]) => any>(
	func: T,
	delay: number,
): (...args: Parameters<T>) => void {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let lastExecTime = 0;

	// biome-ignore lint/suspicious/noExplicitAny: Preserving function context
	return function (this: any, ...args: Parameters<T>) {
		const currentTime = Date.now();

		const execute = () => {
			lastExecTime = Date.now();
			func.apply(this, args);
		};

		if (currentTime - lastExecTime >= delay) {
			execute();
		} else {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}

			const remainingTime = delay - (currentTime - lastExecTime);
			timeoutId = setTimeout(execute, remainingTime);
		}
	};
}

/**
 * Creates a debounced version of a function that delays execution until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked
 */
// biome-ignore lint/suspicious/noExplicitAny: Generic function type requires any
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number,
): (...args: Parameters<T>) => void {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	// biome-ignore lint/suspicious/noExplicitAny: Preserving function context
	return function (this: any, ...args: Parameters<T>) {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}

		timeoutId = setTimeout(() => {
			func.apply(this, args);
		}, wait);
	};
}
