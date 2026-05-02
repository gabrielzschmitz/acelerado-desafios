/* Exemplo passthrough: copia stdin pra stdout sem alterar nada. */
#include <stdio.h>

int main(void) {
    char buf[8192];
    size_t n;
    while ((n = fread(buf, 1, sizeof buf, stdin)) > 0) {
        if (fwrite(buf, 1, n, stdout) != n) return 1;
    }
    return 0;
}
