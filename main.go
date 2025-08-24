package main

import (
	"embed"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	goruntime "runtime"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"weld/backend"
)

//go:embed all:frontend/dist
var assets embed.FS

// BuildMenu creates the application menu
func BuildMenu(app *backend.App) *menu.Menu {
	appMenu := menu.NewMenu()

	// On macOS, add the app menu first
	if goruntime.GOOS == "darwin" {
		appMenu.Append(menu.AppMenu())
	}

	// File menu
	fileMenu := appMenu.AddSubmenu("File")

	// Save submenu
	saveMenu := fileMenu.AddSubmenu("Save")

	// Save Left Pane
	saveLeftItem := saveMenu.AddText("Save Left Pane", nil, func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.GetContext(), "menu-save-left")
	})
	app.SetSaveLeftMenuItem(saveLeftItem)
	saveLeftItem.Disabled = true

	// Save Right Pane
	saveRightItem := saveMenu.AddText("Save Right Pane", nil, func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.GetContext(), "menu-save-right")
	})
	app.SetSaveRightMenuItem(saveRightItem)
	saveRightItem.Disabled = true

	// Save All
	saveAllItem := saveMenu.AddText("Save All", keys.CmdOrCtrl("s"), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.GetContext(), "menu-save-all")
	})
	app.SetSaveAllMenuItem(saveAllItem)
	saveAllItem.Disabled = true

	// Only add Quit to File menu on non-macOS platforms
	// macOS has Quit in the application menu (Weld > Quit Weld)
	if goruntime.GOOS != "darwin" {
		fileMenu.AddSeparator()
		fileMenu.AddText("Quit", keys.CmdOrCtrl("q"), func(_ *menu.CallbackData) {
			runtime.Quit(app.GetContext())
		})
	}

	// Edit menu - custom implementation to add undo
	editMenu := appMenu.AddSubmenu("Edit")
	editMenu.AddText("Cut", keys.CmdOrCtrl("x"), nil)
	editMenu.AddText("Copy", keys.CmdOrCtrl("c"), nil)
	editMenu.AddText("Paste", keys.CmdOrCtrl("v"), nil)
	editMenu.AddText("Select All", keys.CmdOrCtrl("a"), nil)
	editMenu.AddSeparator()

	// Undo menu item
	undoItem := editMenu.AddText("Undo", keys.CmdOrCtrl("z"), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.GetContext(), "menu-undo")
	})

	// Store reference to undo menu item
	app.SetUndoMenuItem(undoItem)

	// Set initial state
	undoItem.Disabled = true

	// Discard All Changes menu item
	discardItem := editMenu.AddText("Discard All Changes", nil, func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.GetContext(), "menu-discard-all")
	})
	app.SetDiscardMenuItem(discardItem)
	discardItem.Disabled = true

	editMenu.AddSeparator()

	// Copy to Left menu item
	copyLeftItem := editMenu.AddText("Copy to Left", keys.Shift("h"), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.GetContext(), "menu-copy-left")
	})
	app.SetCopyLeftMenuItem(copyLeftItem)
	copyLeftItem.Disabled = true

	// Copy to Right menu item
	copyRightItem := editMenu.AddText("Copy to Right", keys.Shift("l"), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.GetContext(), "menu-copy-right")
	})
	app.SetCopyRightMenuItem(copyRightItem)
	copyRightItem.Disabled = true

	// View menu
	viewMenu := appMenu.AddSubmenu("View")
	minimapItem := viewMenu.AddText("Show Minimap", keys.CmdOrCtrl("m"), func(cd *menu.CallbackData) {
		// Toggle minimap visibility
		app.SetMinimapVisible(!app.GetMinimapVisible())
		runtime.EventsEmit(app.GetContext(), "toggle-minimap", app.GetMinimapVisible())
	})

	// Store reference to menu item for dynamic updates
	app.SetMinimapMenuItem(minimapItem)

	// Set initial checkmark state
	if app.GetMinimapVisible() {
		minimapItem.Checked = true
	}

	// Go menu
	goMenu := appMenu.AddSubmenu("Go")

	// First Diff
	firstDiffItem := goMenu.AddText("First Diff", keys.Key("g"), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.GetContext(), "menu-first-diff")
	})
	app.SetFirstDiffMenuItem(firstDiffItem)
	firstDiffItem.Disabled = true

	// Last Diff
	lastDiffItem := goMenu.AddText("Last Diff", keys.Shift("G"), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.GetContext(), "menu-last-diff")
	})
	app.SetLastDiffMenuItem(lastDiffItem)
	lastDiffItem.Disabled = true

	goMenu.AddSeparator()

	// Previous Diff
	prevDiffItem := goMenu.AddText("Previous Diff", keys.Key("k"), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.GetContext(), "menu-prev-diff")
	})
	app.SetPrevDiffMenuItem(prevDiffItem)
	prevDiffItem.Disabled = true

	// Next Diff
	nextDiffItem := goMenu.AddText("Next Diff", keys.Key("j"), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.GetContext(), "menu-next-diff")
	})
	app.SetNextDiffMenuItem(nextDiffItem)
	nextDiffItem.Disabled = true

	return appMenu
}

func main() {
	// Parse command line arguments
	flag.Parse()
	args := flag.Args()

	var leftFile, rightFile string

	// Check if we have file arguments
	if len(args) >= 2 {
		// Convert to absolute paths (shell already handles tilde expansion)
		var err error
		leftFile, err = filepath.Abs(args[0])
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error resolving left file path: %v\n", err)
			os.Exit(1)
		}

		rightFile, err = filepath.Abs(args[1])
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error resolving right file path: %v\n", err)
			os.Exit(1)
		}

		// Verify files exist
		if _, err := os.Stat(leftFile); os.IsNotExist(err) {
			fmt.Fprintf(os.Stderr, "Left file does not exist: %s\n", leftFile)
			os.Exit(1)
		}

		if _, err := os.Stat(rightFile); os.IsNotExist(err) {
			fmt.Fprintf(os.Stderr, "Right file does not exist: %s\n", rightFile)
			os.Exit(1)
		}

		// Check if files are binary
		isBinaryLeft, err := backend.IsBinaryFile(leftFile)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error checking left file: %v\n", err)
			os.Exit(1)
		}
		if isBinaryLeft {
			fmt.Fprintf(os.Stderr, "Cannot compare binary file: %s\n", leftFile)
			os.Exit(1)
		}

		isBinaryRight, err := backend.IsBinaryFile(rightFile)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error checking right file: %v\n", err)
			os.Exit(1)
		}
		if isBinaryRight {
			fmt.Fprintf(os.Stderr, "Cannot compare binary file: %s\n", rightFile)
			os.Exit(1)
		}

		// Files are valid and will be opened
	}

	// Create an instance of the app structure
	app := backend.NewApp()
	app.InitialLeftFile = leftFile
	app.InitialRightFile = rightFile

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "Weld",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.Startup,
		OnShutdown:       app.Shutdown,
		OnBeforeClose:    app.OnBeforeClose,
		Menu:             BuildMenu(app),
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
