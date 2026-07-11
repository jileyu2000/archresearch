from __future__ import annotations

import struct
import zlib

import pytest

from archresearch_api.inspection import difference_hash


def _grayscale_png(rows: list[list[int]], *, compress_level: int = 6) -> bytes:
    width = len(rows[0])
    height = len(rows)
    raw = b"".join(b"\x00" + bytes(row) for row in rows)

    def chunk(kind: bytes, data: bytes) -> bytes:
        payload = kind + data
        return (
            struct.pack(">I", len(data))
            + payload
            + struct.pack(">I", zlib.crc32(payload) & 0xFFFFFFFF)
        )

    header = struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw, level=compress_level))
        + chunk(b"IEND", b"")
    )


def test_difference_hash_is_stable_across_png_encodings() -> None:
    row = [0, 32, 64, 96, 128, 160, 192, 224, 255]
    rows = [row for _ in range(8)]

    uncompressed = _grayscale_png(rows, compress_level=0)
    compressed = _grayscale_png(rows, compress_level=9)

    assert uncompressed != compressed
    assert difference_hash(uncompressed) == difference_hash(compressed)
    assert len(difference_hash(compressed)) == 16


def test_difference_hash_represents_horizontal_pixel_relationships() -> None:
    ascending = [[0, 32, 64, 96, 128, 160, 192, 224, 255] for _ in range(8)]
    descending = [list(reversed(row)) for row in ascending]

    assert difference_hash(_grayscale_png(ascending)) == "0000000000000000"
    assert difference_hash(_grayscale_png(descending)) == "ffffffffffffffff"


def test_difference_hash_rejects_an_undecodable_image() -> None:
    with pytest.raises(ValueError, match="decoded"):
        difference_hash(b"not-an-image")
