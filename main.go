package main

import (
	"embed"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

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
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
