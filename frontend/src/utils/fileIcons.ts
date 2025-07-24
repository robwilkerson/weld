// Import all SVG icons
import bashIcon from "../assets/file-icons/bash.svg?raw";
import cIcon from "../assets/file-icons/c.svg?raw";
import cppIcon from "../assets/file-icons/cpp.svg?raw";
import csIcon from "../assets/file-icons/cs.svg?raw";
import cssIcon from "../assets/file-icons/css.svg?raw";
import defaultIcon from "../assets/file-icons/default.svg?raw";
import dockerIcon from "../assets/file-icons/docker.svg?raw";
import gitIcon from "../assets/file-icons/git.svg?raw";
import goIcon from "../assets/file-icons/go.svg?raw";
import htmlIcon from "../assets/file-icons/html.svg?raw";
import javaIcon from "../assets/file-icons/java.svg?raw";
import jsIcon from "../assets/file-icons/js.svg?raw";
import jsonIcon from "../assets/file-icons/json.svg?raw";
import lessIcon from "../assets/file-icons/less.svg?raw";
import mdIcon from "../assets/file-icons/md.svg?raw";
import phpIcon from "../assets/file-icons/php.svg?raw";
import pyIcon from "../assets/file-icons/py.svg?raw";
import rbIcon from "../assets/file-icons/rb.svg?raw";
import rsIcon from "../assets/file-icons/rs.svg?raw";
import sassIcon from "../assets/file-icons/sass.svg?raw";
import sqlIcon from "../assets/file-icons/sql.svg?raw";
import svelteIcon from "../assets/file-icons/svelte.svg?raw";
import swiftIcon from "../assets/file-icons/swift.svg?raw";
import tomlIcon from "../assets/file-icons/toml.svg?raw";
import tsIcon from "../assets/file-icons/ts.svg?raw";
import txtIcon from "../assets/file-icons/txt.svg?raw";
import vueIcon from "../assets/file-icons/vue.svg?raw";
import xmlIcon from "../assets/file-icons/xml.svg?raw";
import yamlIcon from "../assets/file-icons/yaml.svg?raw";

// Process SVG to ensure proper sizing and remove title elements
function processSvg(svg: string, isDarkMode: boolean = false): string {
	// Remove title elements to prevent unwanted tooltips
	let processed = svg.replace(/<title[^>]*>.*?<\/title>/g, "");

	// Only modify the root SVG element's width/height, not inner elements
	processed = processed.replace(/<svg([^>]*)>/g, (_match, attrs) => {
		// Remove width and height from svg tag attributes
		const cleanedAttrs = attrs
			.replace(/\s*width="[^"]*"/g, "")
			.replace(/\s*height="[^"]*"/g, "");
		// Make icons larger - 28px to fit nicely in the 32px button
		return `<svg${cleanedAttrs} width="28" height="28">`;
	});

	// Adjust colors for dark mode for specific icons
	if (isDarkMode) {
		// Convert black/very dark colors to light colors for better visibility
		processed = processed
			.replace(/fill="#000000"/g, 'fill="#e6e9ef"')
			.replace(/fill="#050505"/g, 'fill="#e6e9ef"')
			.replace(/fill="#000"/g, 'fill="#e6e9ef"')
			// Handle inline styles for icons like Rust
			.replace(/style="fill:#050505"/g, 'style="fill:#e6e9ef"')
			// Also handle stroke colors for icons like .txt
			.replace(/stroke="#000000"/g, 'stroke="#e6e9ef"')
			.replace(/stroke="#000"/g, 'stroke="#e6e9ef"')
			// Lighten default/unknown icon colors for better visibility in dark mode
			.replace(/fill="#95a5a6"/g, 'fill="#c5d5d6"') // Medium gray becomes light gray
			.replace(/fill="#bdc3c7"/g, 'fill="#e6e9ef"'); // Light gray becomes very light gray
	}

	// Darken default/unknown icon for light mode visibility
	if (!isDarkMode) {
		processed = processed
			.replace(/fill="#95a5a6"/g, 'fill="#6a7a7b"') // Medium gray becomes darker
			.replace(/fill="#bdc3c7"/g, 'fill="#8a9a9b"'); // Light gray becomes medium gray
	}

	// Change JSON icon yellow to creamy orange for better visibility in both themes
	processed = processed.replace(/fill="#f5de19"/g, 'fill="#FFB366"');

	// Change SQL icon yellow to medium blue for better visibility in both themes
	processed = processed
		.replace(/fill="#ffda44"/g, 'fill="#4A90E2"')
		.replace(/fill:#ffda44/g, "fill:#4A90E2");

	// Special handling for Less icon in dark mode (needs color reversal)
	if (isDarkMode && svg.includes("linearGradient-1")) {
		// Invert the Less icon colors for dark mode: white background, blue text
		processed = processed
			.replace(/fill="#FAF9F8"/g, 'fill="#2E4F82"') // White text becomes blue
			.replace(/stop-color="#2E4F82"/g, 'stop-color="#FAF9F8"') // Blue gradient becomes white
			.replace(/stop-color="#182E4D"/g, 'stop-color="#E6E9EF"'); // Dark blue becomes light gray
	}

	return processed;
}

export function getFileIcon(
	fileName: string,
	isDarkMode: boolean = false,
): string {
	if (!fileName || fileName.includes("Select")) {
		return processSvg(defaultIcon, isDarkMode);
	}

	const ext = fileName.split(".").pop()?.toLowerCase();
	const lowerFileName = fileName.toLowerCase();

	// Check for special files first
	if (lowerFileName === "dockerfile" || lowerFileName.includes("docker")) {
		return processSvg(dockerIcon, isDarkMode);
	}
	if (
		lowerFileName === ".gitignore" ||
		lowerFileName === ".gitconfig" ||
		lowerFileName.includes("git")
	) {
		return processSvg(gitIcon, isDarkMode);
	}

	switch (ext) {
		// JavaScript/TypeScript
		case "js":
		case "jsx":
			return processSvg(jsIcon, isDarkMode);
		case "ts":
		case "tsx":
			return processSvg(tsIcon, isDarkMode);

		// Python
		case "py":
			return processSvg(pyIcon, isDarkMode);

		// Go
		case "go":
			return processSvg(goIcon, isDarkMode);

		// Rust
		case "rs":
			return processSvg(rsIcon, isDarkMode);

		// Java
		case "java":
			return processSvg(javaIcon, isDarkMode);

		// C/C++
		case "c":
		case "h":
			return processSvg(cIcon, isDarkMode);
		case "cpp":
		case "cc":
		case "hpp":
			return processSvg(cppIcon, isDarkMode);

		// C#
		case "cs":
			return processSvg(csIcon, isDarkMode);

		// Ruby
		case "rb":
			return processSvg(rbIcon, isDarkMode);

		// PHP
		case "php":
			return processSvg(phpIcon, isDarkMode);

		// Swift
		case "swift":
			return processSvg(swiftIcon, isDarkMode);

		// SQL
		case "sql":
			return processSvg(sqlIcon, isDarkMode);

		// Web files
		case "html":
			return processSvg(htmlIcon, isDarkMode);
		case "css":
			return processSvg(cssIcon, isDarkMode);
		case "scss":
		case "sass":
			return processSvg(sassIcon, isDarkMode);
		case "less":
			return processSvg(lessIcon, isDarkMode);
		case "vue":
			return processSvg(vueIcon, isDarkMode);
		case "svelte":
			return processSvg(svelteIcon, isDarkMode);

		// Data files
		case "json":
			return processSvg(jsonIcon, isDarkMode);
		case "xml":
			return processSvg(xmlIcon, isDarkMode);
		case "yaml":
		case "yml":
			return processSvg(yamlIcon, isDarkMode);
		case "toml":
			return processSvg(tomlIcon, isDarkMode);

		// Docs
		case "md":
		case "markdown":
			return processSvg(mdIcon, isDarkMode);
		case "txt":
			return processSvg(txtIcon, isDarkMode);

		// Shell scripts
		case "sh":
		case "bash":
		case "zsh":
		case "fish":
			return processSvg(bashIcon, isDarkMode);

		// Environment files
		case "env":
			return processSvg(defaultIcon, isDarkMode); // Using default since we don't have a specific env icon

		default:
			return processSvg(defaultIcon, isDarkMode);
	}
}

export function getFileTypeName(fileName: string): string {
	if (!fileName || fileName.includes("Select")) return "No file selected";

	const ext = fileName.split(".").pop()?.toLowerCase();
	const lowerFileName = fileName.toLowerCase();

	// Check for special files first
	if (lowerFileName === "dockerfile" || lowerFileName.includes("docker")) {
		return "Docker";
	}
	if (
		lowerFileName === ".gitignore" ||
		lowerFileName === ".gitconfig" ||
		lowerFileName.includes("git")
	) {
		return "Git";
	}

	switch (ext) {
		// Code files
		case "js":
			return "JavaScript";
		case "jsx":
			return "JavaScript (JSX)";
		case "ts":
			return "TypeScript";
		case "tsx":
			return "TypeScript (TSX)";
		case "py":
			return "Python";
		case "go":
			return "Go";
		case "rs":
			return "Rust";
		case "java":
			return "Java";
		case "c":
			return "C";
		case "cpp":
		case "cc":
			return "C++";
		case "h":
			return "C Header";
		case "hpp":
			return "C++ Header";
		case "cs":
			return "C#";
		case "rb":
			return "Ruby";
		case "php":
			return "PHP";
		case "swift":
			return "Swift";
		case "sql":
			return "SQL";

		// Web files
		case "html":
			return "HTML";
		case "css":
			return "CSS";
		case "scss":
			return "SCSS";
		case "sass":
			return "Sass";
		case "less":
			return "Less";
		case "vue":
			return "Vue";
		case "svelte":
			return "Svelte";

		// Data files
		case "json":
			return "JSON";
		case "xml":
			return "XML";
		case "yaml":
		case "yml":
			return "YAML";
		case "toml":
			return "TOML";

		// Docs
		case "md":
		case "markdown":
			return "Markdown";
		case "txt":
			return "Text";

		// Environment
		case "env":
			return "Environment File";

		// Shell
		case "sh":
		case "bash":
		case "zsh":
		case "fish":
			return "Shell Script";

		default:
			return "Unknown File Type";
	}
}
