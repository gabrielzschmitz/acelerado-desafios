// Exemplo passthrough: copia stdin pra stdout sem alterar nada.
use std::io;

fn main() -> io::Result<()> {
    io::copy(&mut io::stdin().lock(), &mut io::stdout().lock())?;
    Ok(())
}
