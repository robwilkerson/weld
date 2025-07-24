/**
 * Application entry point
 * 
 * This file is intentionally not unit tested because:
 * - It's pure boilerplate with no business logic
 * - Testing would require mocking the DOM and Svelte internals
 * - It's implicitly tested when the application runs
 * - The value of testing this file is minimal compared to the effort
 */
import "./style.css";
import App from "./App.svelte";

const app = new App({
	target: document.getElementById("app"),
});

export default app;
