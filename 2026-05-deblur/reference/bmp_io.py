"""
24-bit grayscale BMP I/O (R=G=B), strict format.

Format produced and accepted:
  - 14B BITMAPFILEHEADER:
        bfType    'BM'
        bfSize    file size (54 + pixels)
        bfRsv1/2  0
        bfOffBits 54
  - 40B BITMAPINFOHEADER:
        biSize         40
        biWidth        w
        biHeight       h        (positive: rows stored bottom-to-top)
        biPlanes       1
        biBitCount     24
        biCompression  0  (BI_RGB)
        biSizeImage    pixels_size
        biXPelsPerM    2835
        biYPelsPerM    2835
        biClrUsed      0
        biClrImportant 0
  - Pixel data at offset 54: rows bottom-to-top, BGR triples per pixel
    (we write R=G=B for grayscale), each row padded to a multiple of 4 bytes.
    For width 512 (×3 = 1536 ≡ 0 mod 4) there is no padding.
"""
from __future__ import annotations

import struct
from typing import BinaryIO

import numpy as np

_FILE_HDR = "<2sIHHI"   # 14 bytes
_INFO_HDR = "<IiiHHIIiiII"  # 40 bytes
_HDR_SIZE = 54


def _row_stride(w: int) -> int:
    return ((w * 3 + 3) // 4) * 4


def write(stream: BinaryIO, gray: np.ndarray) -> None:
    """Write a 2D uint8 array as a 24-bit BMP to ``stream``."""
    if gray.ndim != 2:
        raise ValueError(f"expected 2D array, got shape {gray.shape}")
    if gray.dtype != np.uint8:
        gray = np.clip(gray, 0, 255).astype(np.uint8)

    h, w = gray.shape
    stride = _row_stride(w)
    pad = stride - w * 3
    pixels_size = stride * h

    stream.write(struct.pack(_FILE_HDR, b"BM", _HDR_SIZE + pixels_size, 0, 0, _HDR_SIZE))
    stream.write(struct.pack(_INFO_HDR,
        40, w, h, 1, 24, 0, pixels_size, 2835, 2835, 0, 0))

    # rows bottom-to-top, BGR (R=G=B so order is irrelevant)
    rgb = np.repeat(gray[:, :, None], 3, axis=2)[::-1]
    if pad == 0:
        stream.write(rgb.tobytes())
    else:
        zero_pad = bytes(pad)
        for row in rgb:
            stream.write(row.tobytes())
            stream.write(zero_pad)


def read(stream: BinaryIO) -> np.ndarray:
    """Read a 24-bit BMP from ``stream``, return a 2D uint8 array (top-to-bottom)."""
    data = stream.read()
    if len(data) < _HDR_SIZE or data[:2] != b"BM":
        raise ValueError(f"not a BMP: starts with {data[:2]!r}")

    pix_off = struct.unpack_from("<I", data, 10)[0]
    w, h = struct.unpack_from("<ii", data, 18)
    bpp = struct.unpack_from("<H", data, 28)[0]
    comp = struct.unpack_from("<I", data, 30)[0]
    if bpp != 24 or comp != 0:
        raise ValueError(f"need 24-bit uncompressed BMP, got bpp={bpp} comp={comp}")

    stride = _row_stride(w)
    rows = np.empty((h, w), dtype=np.uint8)
    for r in range(h):
        off = pix_off + r * stride
        row_bgr = np.frombuffer(data[off : off + w * 3], dtype=np.uint8).reshape(w, 3)
        rows[h - 1 - r] = row_bgr[:, 0]  # R=G=B; pick blue channel (BGR layout)
    return rows


def write_path(path, gray: np.ndarray) -> None:
    with open(path, "wb") as f:
        write(f, gray)


def read_path(path) -> np.ndarray:
    with open(path, "rb") as f:
        return read(f)
