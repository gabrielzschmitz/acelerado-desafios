// Exemplo passthrough: copia stdin pra stdout sem alterar nada.
#include <iostream>

int main() {
    std::ios_base::sync_with_stdio(false);
    std::cout << std::cin.rdbuf();
    return 0;
}
