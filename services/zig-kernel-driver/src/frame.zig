const std = @import("std");

pub const Frame = struct {
    captured_ms: u64,
    x: f32,
    y: f32,
    z: f32,
};

pub const DecodeError = error{ InvalidLength, InvalidMagic, InvalidReservedField, NonFiniteSample };

fn readU32Le(bytes: []const u8) u32 {
    return @as(u32, bytes[0]) |
        (@as(u32, bytes[1]) << 8) |
        (@as(u32, bytes[2]) << 16) |
        (@as(u32, bytes[3]) << 24);
}

fn readU64Le(bytes: []const u8) u64 {
    var value: u64 = 0;
    for (bytes[0..8], 0..) |byte, index| {
        value |= @as(u64, byte) << @intCast(index * 8);
    }
    return value;
}

pub fn decode(bytes: []const u8) DecodeError!Frame {
    if (bytes.len != 28) return error.InvalidLength;
    if (!std.mem.eql(u8, bytes[0..4], "SEIS")) return error.InvalidMagic;

    const x: f32 = @bitCast(readU32Le(bytes[12..16]));
    const y: f32 = @bitCast(readU32Le(bytes[16..20]));
    const z: f32 = @bitCast(readU32Le(bytes[20..24]));
    if (!std.math.isFinite(x) or !std.math.isFinite(y) or !std.math.isFinite(z)) {
        return error.NonFiniteSample;
    }
    if (readU32Le(bytes[24..28]) != 0) return error.InvalidReservedField;

    return .{
        .captured_ms = readU64Le(bytes[4..12]),
        .x = x,
        .y = y,
        .z = z,
    };
}

test "decodes a bounded sensor frame and rejects malformed frames" {
    var bytes = [_]u8{0} ** 28;
    @memcpy(bytes[0..4], "SEIS");
    bytes[4] = 9;
    bytes[12] = 0;
    bytes[13] = 0;
    bytes[14] = 128;
    bytes[15] = 63;
    const frame = try decode(&bytes);
    try std.testing.expectEqual(@as(u64, 9), frame.captured_ms);
    try std.testing.expectEqual(@as(f32, 1.0), frame.x);
    try std.testing.expectError(error.InvalidLength, decode(bytes[0..27]));
    bytes[0] = 0;
    try std.testing.expectError(error.InvalidMagic, decode(&bytes));
}
