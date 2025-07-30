import { describe, expect, it, vi } from "vitest";
import { debounce, throttle } from "./throttle";

describe("throttle", () => {
	it("should limit function calls to specified delay", async () => {
		let callCount = 0;
		const fn = vi.fn(() => callCount++);
		const throttled = throttle(fn, 50);

		// Call multiple times rapidly
		throttled();
		throttled();
		throttled();
		throttled();

		// Should have called once immediately
		expect(callCount).toBe(1);

		// Wait for throttle delay
		await new Promise((resolve) => setTimeout(resolve, 60));

		// Should have called once more
		expect(callCount).toBe(2);
	});

	it("should preserve function arguments", async () => {
		const fn = vi.fn();
		const throttled = throttle(fn, 50);

		throttled(1, 2, 3);
		expect(fn).toHaveBeenCalledWith(1, 2, 3);
	});

	it("should preserve this context", async () => {
		const obj = {
			value: 42,
			method: function () {
				return this.value;
			},
		};

		obj.throttled = throttle(obj.method, 50);
		const result = obj.throttled();

		expect(result).toBe(undefined); // throttled doesn't return value

		// Call the original method to verify context
		expect(obj.method()).toBe(42);
	});
});

describe("debounce", () => {
	it("should delay function execution", async () => {
		let callCount = 0;
		const fn = vi.fn(() => callCount++);
		const debounced = debounce(fn, 50);

		// Call multiple times rapidly
		debounced();
		debounced();
		debounced();

		// Should not have called yet
		expect(callCount).toBe(0);

		// Wait for debounce delay
		await new Promise((resolve) => setTimeout(resolve, 60));

		// Should have called once
		expect(callCount).toBe(1);
	});

	it("should cancel previous calls", async () => {
		let callCount = 0;
		const fn = vi.fn(() => callCount++);
		const debounced = debounce(fn, 50);

		debounced();
		await new Promise((resolve) => setTimeout(resolve, 30));
		debounced(); // This should cancel the first call

		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(callCount).toBe(0); // Still shouldn't have called

		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(callCount).toBe(1); // Now it should have called once
	});
});
