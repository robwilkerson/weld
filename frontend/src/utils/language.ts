/**
 * Language detection utilities for syntax highlighting
 */

const languageMap: Record<string, string> = {
	js: "javascript",
	jsx: "javascript",
	ts: "typescript",
	tsx: "typescript",
	java: "java",
	go: "go",
	py: "python",
	php: "php",
	rb: "ruby",
	cs: "csharp",
	css: "css",
	scss: "css",
	sass: "css",
	json: "json",
	md: "markdown",
	sh: "bash",
	bash: "bash",
	zsh: "bash",
	c: "c",
	cpp: "cpp",
	h: "c",
	hpp: "cpp",
	rs: "rust",
	xml: "xml",
	html: "html",
	vue: "vue",
	svelte: "svelte",
	yaml: "yaml",
	yml: "yaml",
	toml: "toml",
	sql: "sql",
	kt: "kotlin",
	swift: "swift",
	dart: "dart",
	r: "r",
	scala: "scala",
	clj: "clojure",
	hs: "haskell",
	elm: "elm",
	ex: "elixir",
	erl: "erlang",
	pl: "perl",
	lua: "lua",
};

/**
 * Gets language identifier from file extension
 */
export function getLanguageFromExtension(ext: string): string {
	return languageMap[ext.toLowerCase()] || "text";
}

/**
 * Gets language identifier from filename
 */
export function getLanguageFromFilename(filename: string): string {
	if (!filename) return "markup";

	const ext = filename.split(".").pop()?.toLowerCase();
	return getLanguageFromExtension(ext || "");
}
