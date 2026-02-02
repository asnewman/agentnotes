package main

import (
	"fmt"
	"os"

	"github.com/ashleynewman/agentnotes/internal/cli"
)

func main() {
	app, err := cli.NewApp()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	if err := app.RootCmd().Execute(); err != nil {
		os.Exit(1)
	}
}
