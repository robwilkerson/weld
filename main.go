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
)

//go:embed all:frontend/dist
var assets embed.FS

// BuildMenu creates the application menu
func BuildMenu(app *App) *menu.Menu {
	appMenu := menu.NewMenu()

	// On macOS, add the app menu first
	if goruntime.GOOS == "darwin" {
		appMenu.Append(menu.AppMenu())
	}

	// File menu
	fileMenu := appMenu.AddSubmenu("File")
	fileMenu.AddText("Quit", keys.CmdOrCtrl("q"), func(_ *menu.CallbackData) {
		runtime.Quit(app.ctx)
	})

	// Edit menu - custom implementation to add undo
	editMenu := appMenu.AddSubmenu("Edit")
	editMenu.AddText("Cut", keys.CmdOrCtrl("x"), nil)
	editMenu.AddText("Copy", keys.CmdOrCtrl("c"), nil)
	editMenu.AddText("Paste", keys.CmdOrCtrl("v"), nil)
	editMenu.AddText("Select All", keys.CmdOrCtrl("a"), nil)
	editMenu.AddSeparator()

	// Undo menu item
	undoItem := editMenu.AddText("Undo", keys.CmdOrCtrl("z"), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.ctx, "menu-undo")
	})

	// Store reference to undo menu item
	app.SetUndoMenuItem(undoItem)

	// Set initial state
	undoItem.Disabled = true

	// View menu
	viewMenu := appMenu.AddSubmenu("View")
	minimapItem := viewMenu.AddText("Show Minimap", keys.CmdOrCtrl("m"), func(cd *menu.CallbackData) {
		// Toggle minimap visibility
		app.SetMinimapVisible(!app.GetMinimapVisible())
		runtime.EventsEmit(app.ctx, "toggle-minimap", app.GetMinimapVisible())
	})

	// Store reference to menu item for dynamic updates
	app.SetMinimapMenuItem(minimapItem)

	// Set initial checkmark state
	if app.GetMinimapVisible() {
		minimapItem.Checked = true
	}

	return appMenu
}

func main() {
	// Parse command line arguments
	flag.Parse()
	args := flag.Args()

	var leftFile, rightFile string

	// Check if we have file arguments
	if len(args) >= 2 {
		// Convert to absolute paths
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

		fmt.Printf("Opening with files: %s and %s\n", leftFile, rightFile)
	}

	// Create an instance of the app structure
	app := NewApp()
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
		OnStartup:        app.startup,
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
