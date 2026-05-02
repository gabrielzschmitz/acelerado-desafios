// Exemplo passthrough: copia stdin pra stdout sem alterar nada.
package main

import (
	"io"
	"os"
)

func main() {
	io.Copy(os.Stdout, os.Stdin)
}
