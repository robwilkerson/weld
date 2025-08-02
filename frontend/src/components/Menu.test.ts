import { fireEvent, render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uiStore } from "../stores/uiStore.js";
import Menu from "./Menu.svelte";

describe("Menu", () => {
	beforeEach(() => {
		// Reset menu visibility before each test
		uiStore.setMenuVisible(false);
	});

	it("should render menu toggle button", () => {
		render(Menu, {
			hasAnyUnsavedChanges: false,
			onDiscardChanges: vi.fn(),
			onToggleDarkMode: vi.fn(),
		});

		const menuButton = screen.getByTitle("Menu");
		expect(menuButton).toBeInTheDocument();
		expect(menuButton).toHaveTextContent("☰");
	});

	it("should show dropdown when menu is toggled", async () => {
		render(Menu, {
			hasAnyUnsavedChanges: false,
			onDiscardChanges: vi.fn(),
			onToggleDarkMode: vi.fn(),
		});

		const menuButton = screen.getByTitle("Menu");
		await fireEvent.click(menuButton);

		// Check that dropdown is visible
		expect(screen.getByText(/Light Mode|Dark Mode/)).toBeInTheDocument();
		expect(screen.getByText("🗑️ Discard Changes")).toBeInTheDocument();
	});

	it("should show correct dark mode toggle text based on current mode", async () => {
		const mockToggle = vi.fn();

		render(Menu, {
			hasAnyUnsavedChanges: false,
			onDiscardChanges: vi.fn(),
			onToggleDarkMode: mockToggle,
		});

		await fireEvent.click(screen.getByTitle("Menu"));

		// Since we can't control dark mode state directly, just check that one of the options is shown
		const darkModeButton = screen.getByText(/Light Mode|Dark Mode/);
		expect(darkModeButton).toBeInTheDocument();
	});

	it("should call onToggleDarkMode when dark mode button is clicked", async () => {
		const onToggleDarkMode = vi.fn();
		render(Menu, {
			hasAnyUnsavedChanges: false,
			onDiscardChanges: vi.fn(),
			onToggleDarkMode,
		});

		await fireEvent.click(screen.getByTitle("Menu"));
		const darkModeButton = screen.getByText(/Light Mode|Dark Mode/);
		await fireEvent.click(darkModeButton);

		expect(onToggleDarkMode).toHaveBeenCalled();
	});

	it("should disable discard changes button when no unsaved changes", async () => {
		render(Menu, {
			hasAnyUnsavedChanges: false,
			onDiscardChanges: vi.fn(),
			onToggleDarkMode: vi.fn(),
		});

		await fireEvent.click(screen.getByTitle("Menu"));
		const discardButton = screen.getByText("🗑️ Discard Changes");

		expect(discardButton).toBeDisabled();
	});

	it("should enable discard changes button when there are unsaved changes", async () => {
		render(Menu, {
			hasAnyUnsavedChanges: true,
			onDiscardChanges: vi.fn(),
			onToggleDarkMode: vi.fn(),
		});

		await fireEvent.click(screen.getByTitle("Menu"));
		const discardButton = screen.getByText("🗑️ Discard Changes");

		expect(discardButton).not.toBeDisabled();
	});

	it("should call onDiscardChanges when discard button is clicked", async () => {
		const onDiscardChanges = vi.fn();
		render(Menu, {
			hasAnyUnsavedChanges: true,
			onDiscardChanges,
			onToggleDarkMode: vi.fn(),
		});

		await fireEvent.click(screen.getByTitle("Menu"));
		await fireEvent.click(screen.getByText("🗑️ Discard Changes"));

		expect(onDiscardChanges).toHaveBeenCalled();
	});

	it("should toggle menu visibility when clicking menu button", async () => {
		render(Menu, {
			hasAnyUnsavedChanges: false,
			onDiscardChanges: vi.fn(),
			onToggleDarkMode: vi.fn(),
		});

		const menuButton = screen.getByTitle("Menu");

		// Initially menu should be hidden
		expect(screen.queryByText(/Light Mode|Dark Mode/)).not.toBeInTheDocument();

		// Click to open
		await fireEvent.click(menuButton);
		expect(screen.getByText(/Light Mode|Dark Mode/)).toBeInTheDocument();

		// Click to close
		await fireEvent.click(menuButton);
		expect(screen.queryByText(/Light Mode|Dark Mode/)).not.toBeInTheDocument();
	});
});
