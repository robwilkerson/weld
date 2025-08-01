import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock the Wails runtime since it's not available in tests
global.runtime = {
	OpenFileDialog: vi.fn(),
};

// Mock console methods to avoid noise in tests
global.console = {
	...console,
	log: vi.fn(),
	error: vi.fn(),
	warn: vi.fn(),
};

// Mock KeyboardEvent for tests
global.KeyboardEvent = class KeyboardEvent extends Event {
	constructor(type: string, init?: KeyboardEventInit) {
		super(type, init);
		this.key = init?.key || "";
		this.ctrlKey = init?.ctrlKey || false;
		this.metaKey = init?.metaKey || false;
		this.preventDefault = vi.fn();
	}
	key: string;
	ctrlKey: boolean;
	metaKey: boolean;
	preventDefault: () => void;
};

// Mock the Wails bindings
vi.mock("../wailsjs/go/main/App.js", () => ({
	SelectFile: vi.fn(),
	CompareFiles: vi.fn(),
	CopyToFile: vi.fn(),
	SaveChanges: vi.fn(),
	HasUnsavedChanges: vi.fn(),
	UpdateSaveMenuItems: vi.fn(),
}));

// Mock PrismJS
vi.mock("prismjs", () => ({
	default: {
		highlight: vi.fn((code: string) => code),
		languages: {
			javascript: {},
			typescript: {},
			markup: {},
		},
	},
}));

// Mock CSS imports
vi.mock("prismjs/themes/prism-tomorrow.css", () => ({}));
vi.mock("prismjs/components/prism-javascript", () => ({}));
vi.mock("prismjs/components/prism-typescript", () => ({}));
vi.mock("prismjs/components/prism-java", () => ({}));
vi.mock("prismjs/components/prism-go", () => ({}));
vi.mock("prismjs/components/prism-python", () => ({}));
vi.mock("prismjs/components/prism-php", () => ({}));
vi.mock("prismjs/components/prism-ruby", () => ({}));
vi.mock("prismjs/components/prism-csharp", () => ({}));
vi.mock("prismjs/components/prism-css", () => ({}));
vi.mock("prismjs/components/prism-json", () => ({}));
vi.mock("prismjs/components/prism-markdown", () => ({}));
vi.mock("prismjs/components/prism-bash", () => ({}));
