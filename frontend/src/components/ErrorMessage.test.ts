import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ErrorMessage from "./ErrorMessage.svelte";

describe("ErrorMessage", () => {
	it("should render error message when message is provided", () => {
		render(ErrorMessage, {
			message: "Something went wrong",
		});

		const errorDiv = screen.getByText("Something went wrong");
		expect(errorDiv).toBeInTheDocument();
		expect(errorDiv).toHaveClass("error");
	});

	it("should not render error div when message is empty", () => {
		render(ErrorMessage, {
			message: "",
		});

		expect(document.querySelector(".error")).toBeNull();
	});

	it("should not render error div when message is undefined", () => {
		render(ErrorMessage, {
			message: undefined as unknown as string,
		});

		expect(document.querySelector(".error")).toBeNull();
	});

	it("should update message when prop changes", async () => {
		const { component } = render(ErrorMessage, {
			message: "First error",
		});

		expect(screen.getByText("First error")).toBeInTheDocument();

		// Update the message
		await component.$set({ message: "Second error" });

		expect(screen.queryByText("First error")).not.toBeInTheDocument();
		expect(screen.getByText("Second error")).toBeInTheDocument();
	});

	it("should hide when message becomes empty", async () => {
		const { component } = render(ErrorMessage, {
			message: "Error message",
		});

		expect(screen.getByText("Error message")).toBeInTheDocument();

		// Clear the message
		await component.$set({ message: "" });

		expect(screen.queryByText("Error message")).not.toBeInTheDocument();
	});
});
