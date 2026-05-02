// Exemplo passthrough: copia stdin pra stdout sem alterar nada.
const std = @import("std");

pub fn main() !void {
    var buf: [8192]u8 = undefined;
    const stdin = std.io.getStdIn().reader();
    const stdout = std.io.getStdOut().writer();
    while (true) {
        const n = try stdin.read(&buf);
        if (n == 0) break;
        try stdout.writeAll(buf[0..n]);
    }
}
