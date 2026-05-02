// Exemplo passthrough: copia stdin pra stdout sem alterar nada.
const std = @import("std");

pub fn main() !void {
    var buf: [8192]u8 = undefined;
    while (true) {
        const n = try std.posix.read(std.posix.STDIN_FILENO, &buf);
        if (n == 0) break;
        var written: usize = 0;
        while (written < n) {
            written += try std.posix.write(std.posix.STDOUT_FILENO, buf[written..n]);
        }
    }
}
