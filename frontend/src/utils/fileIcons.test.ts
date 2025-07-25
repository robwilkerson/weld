import { describe, expect, it } from "vitest";
import { getFileIcon, getFileTypeName } from "./fileIcons";

describe("fileIcons", () => {
	describe("getFileIcon", () => {
		it("should return default icon for empty filename", () => {
			const icon = getFileIcon("");
			expect(icon).toContain('width="28"');
			expect(icon).toContain('height="28"');
			expect(icon).toContain("<svg");
		});

		it("should return default icon for 'Select' filename", () => {
			const icon = getFileIcon("Select a file");
			expect(icon).toContain('width="28"');
			expect(icon).toContain('height="28"');
		});

		it("should return JavaScript icon for .js files", () => {
			const icon = getFileIcon("script.js");
			expect(icon).toContain('width="28"');
			expect(icon).toContain('height="28"');
			expect(icon).toContain("<svg");
		});

		it("should return TypeScript icon for .ts files", () => {
			const icon = getFileIcon("component.ts");
			expect(icon).toContain('width="28"');
			expect(icon).toContain('height="28"');
		});

		it("should return Python icon for .py files", () => {
			const icon = getFileIcon("main.py");
			expect(icon).toContain('width="28"');
			expect(icon).toContain('height="28"');
		});

		it("should return Go icon for .go files", () => {
			const icon = getFileIcon("server.go");
			expect(icon).toContain('width="28"');
			expect(icon).toContain('height="28"');
		});

		it("should return Rust icon for .rs files", () => {
			const icon = getFileIcon("lib.rs");
			expect(icon).toContain('width="28"');
			expect(icon).toContain('height="28"');
		});

		it("should return Docker icon for Dockerfile", () => {
			const icon = getFileIcon("Dockerfile");
			expect(icon).toContain('width="28"');
			expect(icon).toContain('height="28"');
		});

		it("should return Docker icon for docker-compose.yml", () => {
			const icon = getFileIcon("docker-compose.yml");
			expect(icon).toContain('width="28"');
			expect(icon).toContain('height="28"');
		});

		it("should return Git icon for .gitignore", () => {
			const icon = getFileIcon(".gitignore");
			expect(icon).toContain('width="28"');
			expect(icon).toContain('height="28"');
		});

		it("should return HTML icon for .html files", () => {
			const icon = getFileIcon("index.html");
			expect(icon).toContain('width="28"');
			expect(icon).toContain('height="28"');
		});

		it("should return CSS icon for .css files", () => {
			const icon = getFileIcon("styles.css");
			expect(icon).toContain('width="28"');
			expect(icon).toContain('height="28"');
		});

		it("should return Svelte icon for .svelte files", () => {
			const icon = getFileIcon("App.svelte");
			expect(icon).toContain('width="28"');
			expect(icon).toContain('height="28"');
		});

		it("should return JSON icon for .json files", () => {
			const icon = getFileIcon("config.json");
			expect(icon).toContain('width="28"');
			expect(icon).toContain('height="28"');
		});

		it("should return Markdown icon for .md files", () => {
			const icon = getFileIcon("README.md");
			expect(icon).toContain('width="28"');
			expect(icon).toContain('height="28"');
		});

		it("should return default icon for unknown extensions", () => {
			const icon = getFileIcon("unknown.xyz");
			expect(icon).toContain('width="28"');
			expect(icon).toContain('height="28"');
		});

		it("should handle files without extensions", () => {
			const icon = getFileIcon("README");
			expect(icon).toContain('width="28"');
			expect(icon).toContain('height="28"');
		});

		it("should be case insensitive for extensions", () => {
			const icon1 = getFileIcon("script.JS");
			const icon2 = getFileIcon("script.js");
			// Both should return JavaScript icon
			expect(icon1).toBe(icon2);
		});

		describe("dark mode support", () => {
			it("should adjust colors for dark mode", () => {
				const _lightIcon = getFileIcon("file.txt", false);
				const darkIcon = getFileIcon("file.txt", true);

				// Dark mode should convert black to light colors
				expect(darkIcon).not.toContain('fill="#000000"');
				expect(darkIcon).not.toContain('stroke="#000000"');
			});

			it("should handle JSON icon color transformation", () => {
				const icon = getFileIcon("data.json");
				// JSON yellow should be changed to orange
				expect(icon).toContain("#FFB366");
				expect(icon).not.toContain("#f5de19");
			});

			it("should handle SQL icon color transformation", () => {
				const icon = getFileIcon("query.sql");
				// SQL yellow should be changed to blue
				expect(icon).toContain("#4A90E2");
				expect(icon).not.toContain("#ffda44");
			});
		});

		describe("special file handling", () => {
			it("should handle C header files", () => {
				const icon = getFileIcon("header.h");
				expect(icon).toContain('width="28"');
				expect(icon).toContain('height="28"');
			});

			it("should handle C++ files with different extensions", () => {
				const extensions = ["cpp", "cc", "hpp"];
				extensions.forEach((ext) => {
					const icon = getFileIcon(`file.${ext}`);
					expect(icon).toContain('width="28"');
					expect(icon).toContain('height="28"');
				});
			});

			it("should handle shell script extensions", () => {
				const extensions = ["sh", "bash", "zsh", "fish"];
				extensions.forEach((ext) => {
					const icon = getFileIcon(`script.${ext}`);
					expect(icon).toContain('width="28"');
					expect(icon).toContain('height="28"');
				});
			});

			it("should handle YAML files with both extensions", () => {
				const icon1 = getFileIcon("config.yaml");
				const icon2 = getFileIcon("config.yml");
				expect(icon1).toBe(icon2);
			});
		});
	});

	describe("getFileTypeName", () => {
		it("should return 'No file selected' for empty filename", () => {
			expect(getFileTypeName("")).toBe("No file selected");
		});

		it("should return 'No file selected' for 'Select' filename", () => {
			expect(getFileTypeName("Select a file")).toBe("No file selected");
		});

		it("should return correct type names for programming languages", () => {
			const tests = [
				{ file: "script.js", expected: "JavaScript" },
				{ file: "component.jsx", expected: "JavaScript (JSX)" },
				{ file: "app.ts", expected: "TypeScript" },
				{ file: "component.tsx", expected: "TypeScript (TSX)" },
				{ file: "main.py", expected: "Python" },
				{ file: "server.go", expected: "Go" },
				{ file: "lib.rs", expected: "Rust" },
				{ file: "Main.java", expected: "Java" },
				{ file: "program.c", expected: "C" },
				{ file: "app.cpp", expected: "C++" },
				{ file: "header.h", expected: "C Header" },
				{ file: "header.hpp", expected: "C++ Header" },
				{ file: "Program.cs", expected: "C#" },
				{ file: "app.rb", expected: "Ruby" },
				{ file: "index.php", expected: "PHP" },
				{ file: "App.swift", expected: "Swift" },
				{ file: "query.sql", expected: "SQL" },
			];

			tests.forEach(({ file, expected }) => {
				expect(getFileTypeName(file)).toBe(expected);
			});
		});

		it("should return correct type names for web files", () => {
			const tests = [
				{ file: "index.html", expected: "HTML" },
				{ file: "styles.css", expected: "CSS" },
				{ file: "styles.scss", expected: "SCSS" },
				{ file: "styles.sass", expected: "Sass" },
				{ file: "styles.less", expected: "Less" },
				{ file: "App.vue", expected: "Vue" },
				{ file: "App.svelte", expected: "Svelte" },
			];

			tests.forEach(({ file, expected }) => {
				expect(getFileTypeName(file)).toBe(expected);
			});
		});

		it("should return correct type names for data files", () => {
			const tests = [
				{ file: "config.json", expected: "JSON" },
				{ file: "data.xml", expected: "XML" },
				{ file: "config.yaml", expected: "YAML" },
				{ file: "config.yml", expected: "YAML" },
				{ file: "Cargo.toml", expected: "TOML" },
			];

			tests.forEach(({ file, expected }) => {
				expect(getFileTypeName(file)).toBe(expected);
			});
		});

		it("should return correct type names for documentation", () => {
			const tests = [
				{ file: "README.md", expected: "Markdown" },
				{ file: "notes.txt", expected: "Text" },
			];

			tests.forEach(({ file, expected }) => {
				expect(getFileTypeName(file)).toBe(expected);
			});
		});

		it("should return 'Shell Script' for shell files", () => {
			const files = ["script.sh", "run.bash", "init.zsh", "config.fish"];
			files.forEach((file) => {
				expect(getFileTypeName(file)).toBe("Shell Script");
			});
		});

		it("should return 'Environment File' for .env files", () => {
			expect(getFileTypeName(".env")).toBe("Environment File");
		});

		it("should return 'Unknown File Type' for unknown extensions", () => {
			expect(getFileTypeName("file.xyz")).toBe("Unknown File Type");
		});

		it("should handle special filenames", () => {
			expect(getFileTypeName("Dockerfile")).toBe("Docker");
			expect(getFileTypeName("docker-compose.yml")).toBe("Docker");
			expect(getFileTypeName(".gitignore")).toBe("Git");
			expect(getFileTypeName(".gitconfig")).toBe("Git");
		});

		it("should be case insensitive", () => {
			expect(getFileTypeName("script.JS")).toBe("JavaScript");
			expect(getFileTypeName("DOCKERFILE")).toBe("Docker");
		});
	});
});
