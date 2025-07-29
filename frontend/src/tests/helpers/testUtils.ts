import { fireEvent } from "@testing-library/svelte";
import { expect } from "vitest";

/**
 * Helper function to safely click an element, ensuring it exists first
 */
export async function clickElement(
	element: Element | null | undefined,
	elementName = "element",
): Promise<void> {
	expect(element).toBeTruthy();
	if (!element) {
		throw new Error(`${elementName} not found`);
	}
	await fireEvent.click(element);
}

/**
 * Helper function to click the compare button in tests
 */
export async function clickCompareButton(
	container: HTMLElement,
): Promise<void> {
	const compareButton = container.querySelector(".compare-btn");
	await clickElement(compareButton, "Compare button");
}

/**
 * Helper function to select files in tests
 */
export async function selectFiles(container: HTMLElement): Promise<void> {
	const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
	await clickElement(leftButton, "Left file button");
	await clickElement(rightButton, "Right file button");
}

/**
 * Type-safe keyboard event mock that matches the expected interface
 */
export interface MockKeyboardEvent {
	key: string;
	code?: string;
	ctrlKey?: boolean;
	metaKey?: boolean;
	shiftKey?: boolean;
	altKey?: boolean;
	preventDefault: () => void;
}

/**
 * Create a properly typed keyboard event mock
 */
export function createMockKeyboardEvent(
	key: string,
	options: Partial<Omit<MockKeyboardEvent, "key" | "preventDefault">> = {},
): MockKeyboardEvent {
	return {
		key,
		code: options.code || key,
		ctrlKey: options.ctrlKey || false,
		metaKey: options.metaKey || false,
		shiftKey: options.shiftKey || false,
		altKey: options.altKey || false,
		preventDefault: () => {},
		...options,
	};
}
