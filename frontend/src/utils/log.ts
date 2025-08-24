/**
 * Simple logging utility that only logs in development mode
 */

export const logError = (...args: unknown[]): void => {
	if (import.meta.env.DEV) {
		console.error(...args);
	}
};

export const logWarn = (...args: unknown[]): void => {
	if (import.meta.env.DEV) {
		console.warn(...args);
	}
};

export const logInfo = (...args: unknown[]): void => {
	if (import.meta.env.DEV) {
		console.info(...args);
	}
};
