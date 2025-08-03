import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	getModifierKeyName,
	handleKeydown,
	isMacOS,
	type KeyboardHandlerCallbacks,
	type KeyboardHandlerState,
} from "./keyboard";

describe("keyboard utilities", () => {
	let callbacks: KeyboardHandlerCallbacks;
	let state: KeyboardHandlerState;

	beforeEach(() => {
		callbacks = {
			saveLeftFile: vi.fn(),
			saveRightFile: vi.fn(),
			jumpToNextDiff: vi.fn(),
			jumpToPrevDiff: vi.fn(),
			jumpToFirstDiff: vi.fn(),
			jumpToLastDiff: vi.fn(),
			copyCurrentDiffLeftToRight: vi.fn(),
			copyCurrentDiffRightToLeft: vi.fn(),
			undoLastChange: vi.fn(),
			compareFiles: vi.fn(),
			closeMenu: vi.fn(),
		};

		state = {
			leftFilePath: "/path/to/left.txt",
			rightFilePath: "/path/to/right.txt",
			isComparing: false,
			hasCompletedComparison: true,
			showMenu: false,
		};
	});

	describe("handleKeydown", () => {
		describe("navigation shortcuts", () => {
			it("should call jumpToNextDiff on ArrowDown", () => {
				const event = new KeyboardEvent("keydown", { key: "ArrowDown" });
				const preventDefaultSpy = vi.spyOn(event, "preventDefault");

				handleKeydown(event, callbacks, state);

				expect(callbacks.jumpToNextDiff).toHaveBeenCalled();
				expect(preventDefaultSpy).toHaveBeenCalled();
			});

			it("should call jumpToNextDiff on j key", () => {
				const event = new KeyboardEvent("keydown", { key: "j" });
				const preventDefaultSpy = vi.spyOn(event, "preventDefault");

				handleKeydown(event, callbacks, state);

				expect(callbacks.jumpToNextDiff).toHaveBeenCalled();
				expect(preventDefaultSpy).toHaveBeenCalled();
			});

			it("should call jumpToPrevDiff on ArrowUp", () => {
				const event = new KeyboardEvent("keydown", { key: "ArrowUp" });
				const preventDefaultSpy = vi.spyOn(event, "preventDefault");

				handleKeydown(event, callbacks, state);

				expect(callbacks.jumpToPrevDiff).toHaveBeenCalled();
				expect(preventDefaultSpy).toHaveBeenCalled();
			});

			it("should call jumpToPrevDiff on k key", () => {
				const event = new KeyboardEvent("keydown", { key: "k" });
				const preventDefaultSpy = vi.spyOn(event, "preventDefault");

				handleKeydown(event, callbacks, state);

				expect(callbacks.jumpToPrevDiff).toHaveBeenCalled();
				expect(preventDefaultSpy).toHaveBeenCalled();
			});

			it("should call jumpToFirstDiff on g key", () => {
				const event = new KeyboardEvent("keydown", { key: "g" });
				const preventDefaultSpy = vi.spyOn(event, "preventDefault");

				handleKeydown(event, callbacks, state);

				expect(callbacks.jumpToFirstDiff).toHaveBeenCalled();
				expect(preventDefaultSpy).toHaveBeenCalled();
			});

			it("should call jumpToLastDiff on G (Shift+G) key", () => {
				const event = new KeyboardEvent("keydown", {
					key: "G",
					shiftKey: true,
				});
				const preventDefaultSpy = vi.spyOn(event, "preventDefault");

				handleKeydown(event, callbacks, state);

				expect(callbacks.jumpToLastDiff).toHaveBeenCalled();
				expect(preventDefaultSpy).toHaveBeenCalled();
			});
		});

		describe("undo operations", () => {
			it("should call undoLastChange on u key", () => {
				const event = new KeyboardEvent("keydown", { key: "u" });
				const preventDefaultSpy = vi.spyOn(event, "preventDefault");

				handleKeydown(event, callbacks, state);

				expect(callbacks.undoLastChange).toHaveBeenCalled();
				expect(preventDefaultSpy).toHaveBeenCalled();
			});

			it("should call undoLastChange on Ctrl+Z (non-Mac)", () => {
				// Mock non-Mac platform
				Object.defineProperty(navigator, "platform", {
					value: "Win32",
					writable: true,
				});

				const event = new KeyboardEvent("keydown", {
					key: "z",
					ctrlKey: true,
				});
				const preventDefaultSpy = vi.spyOn(event, "preventDefault");

				handleKeydown(event, callbacks, state);

				expect(callbacks.undoLastChange).toHaveBeenCalled();
				expect(preventDefaultSpy).toHaveBeenCalled();
			});

			it("should call undoLastChange on Cmd+Z (Mac)", () => {
				// Mock Mac platform
				Object.defineProperty(navigator, "platform", {
					value: "MacIntel",
					writable: true,
				});

				const event = new KeyboardEvent("keydown", {
					key: "z",
					metaKey: true,
				});
				const preventDefaultSpy = vi.spyOn(event, "preventDefault");

				handleKeydown(event, callbacks, state);

				expect(callbacks.undoLastChange).toHaveBeenCalled();
				expect(preventDefaultSpy).toHaveBeenCalled();
			});
		});

		describe("save operations", () => {
			it("should save both files on Ctrl+S (non-Mac)", () => {
				// Mock non-Mac platform
				Object.defineProperty(navigator, "platform", {
					value: "Win32",
					writable: true,
				});

				const event = new KeyboardEvent("keydown", {
					key: "s",
					ctrlKey: true,
				});
				const preventDefaultSpy = vi.spyOn(event, "preventDefault");

				handleKeydown(event, callbacks, state);

				expect(callbacks.saveLeftFile).toHaveBeenCalled();
				expect(callbacks.saveRightFile).toHaveBeenCalled();
				expect(preventDefaultSpy).toHaveBeenCalled();
			});

			it("should save both files on Cmd+S (Mac)", () => {
				// Mock Mac platform
				Object.defineProperty(navigator, "platform", {
					value: "MacIntel",
					writable: true,
				});

				const event = new KeyboardEvent("keydown", {
					key: "s",
					metaKey: true,
				});
				const preventDefaultSpy = vi.spyOn(event, "preventDefault");

				handleKeydown(event, callbacks, state);

				expect(callbacks.saveLeftFile).toHaveBeenCalled();
				expect(callbacks.saveRightFile).toHaveBeenCalled();
				expect(preventDefaultSpy).toHaveBeenCalled();
			});
		});

		describe("compare files", () => {
			it("should call compareFiles on Enter when conditions are met", () => {
				state.hasCompletedComparison = false;

				const event = new KeyboardEvent("keydown", { key: "Enter" });
				const preventDefaultSpy = vi.spyOn(event, "preventDefault");

				handleKeydown(event, callbacks, state);

				expect(callbacks.compareFiles).toHaveBeenCalled();
				expect(preventDefaultSpy).toHaveBeenCalled();
			});

			it("should not call compareFiles on Enter when already comparing", () => {
				state.isComparing = true;
				state.hasCompletedComparison = false;

				const event = new KeyboardEvent("keydown", { key: "Enter" });

				handleKeydown(event, callbacks, state);

				expect(callbacks.compareFiles).not.toHaveBeenCalled();
			});

			it("should not call compareFiles on Enter when comparison completed", () => {
				state.hasCompletedComparison = true;

				const event = new KeyboardEvent("keydown", { key: "Enter" });

				handleKeydown(event, callbacks, state);

				expect(callbacks.compareFiles).not.toHaveBeenCalled();
			});
		});

		describe("menu operations", () => {
			it("should close menu on Escape when menu is shown", () => {
				state.showMenu = true;

				const event = new KeyboardEvent("keydown", { key: "Escape" });
				const preventDefaultSpy = vi.spyOn(event, "preventDefault");

				handleKeydown(event, callbacks, state);

				expect(callbacks.closeMenu).toHaveBeenCalled();
				expect(preventDefaultSpy).toHaveBeenCalled();
			});

			it("should not close menu on Escape when menu is not shown", () => {
				state.showMenu = false;

				const event = new KeyboardEvent("keydown", { key: "Escape" });

				handleKeydown(event, callbacks, state);

				expect(callbacks.closeMenu).not.toHaveBeenCalled();
			});
		});
	});

	describe("utility functions", () => {
		it("should detect macOS platform", () => {
			Object.defineProperty(navigator, "platform", {
				value: "MacIntel",
				writable: true,
			});

			expect(isMacOS()).toBe(true);
		});

		it("should detect non-macOS platform", () => {
			Object.defineProperty(navigator, "platform", {
				value: "Win32",
				writable: true,
			});

			expect(isMacOS()).toBe(false);
		});

		it("should return correct modifier key name for Mac", () => {
			Object.defineProperty(navigator, "platform", {
				value: "MacIntel",
				writable: true,
			});

			expect(getModifierKeyName()).toBe("Cmd");
		});

		it("should return correct modifier key name for non-Mac", () => {
			Object.defineProperty(navigator, "platform", {
				value: "Linux x86_64",
				writable: true,
			});

			expect(getModifierKeyName()).toBe("Ctrl");
		});
	});
});
