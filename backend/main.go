package main

import (
	"fmt"
	"log"
	"net/http"
)

func Homepage(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "Home HTTP")
}

func SetupPages() {
	http.HandleFunc("/", Homepage)
}

func main() {
	fmt.Printf("Starting Page")
	SetupPages()
	log.Fatal(http.ListenAndServe(":8080", nil))
}
