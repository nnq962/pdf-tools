from __future__ import annotations

import re
import zipfile
from dataclasses import dataclass
from io import BytesIO

from pypdf import PdfReader, PdfWriter


class PdfSplitError(ValueError):
    pass


@dataclass(frozen=True)
class PdfChunk:
    file_name: str
    from_page: int
    to_page: int


def get_pdf_page_count(pdf_bytes: bytes) -> int:
    try:
        reader = PdfReader(BytesIO(pdf_bytes))
    except Exception as exc:
        raise PdfSplitError("Không thể đọc tệp PDF này.") from exc

    total_pages = len(reader.pages)

    if total_pages == 0:
        raise PdfSplitError("Tệp PDF không có trang nào.")

    return total_pages


def normalize_output_file_name(file_name: str, fallback_name: str) -> str:
    normalized = re.sub(r'[\\/:*?"<>|]+', "-", file_name.strip())
    normalized = re.sub(r"\s+", " ", normalized).strip(" .")

    if not normalized:
        normalized = fallback_name

    if not normalized.lower().endswith(".pdf"):
        normalized = f"{normalized}.pdf"

    return normalized


def split_pdf_to_zip(pdf_bytes: bytes, chunks: list[PdfChunk]) -> bytes:
    if not chunks:
        raise PdfSplitError("Cần ít nhất một phần để tách PDF.")

    try:
        reader = PdfReader(BytesIO(pdf_bytes))
    except Exception as exc:
        raise PdfSplitError("Không thể đọc tệp PDF này.") from exc

    total_pages = len(reader.pages)

    if total_pages == 0:
        raise PdfSplitError("Tệp PDF không có trang nào.")

    zip_buffer = BytesIO()
    used_names: set[str] = set()

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for index, chunk in enumerate(chunks, start=1):
            if chunk.from_page < 1 or chunk.to_page < 1:
                raise PdfSplitError("Số trang phải lớn hơn hoặc bằng 1.")

            if chunk.from_page > chunk.to_page:
                raise PdfSplitError("Trang bắt đầu không được lớn hơn trang kết thúc.")

            if chunk.to_page > total_pages:
                raise PdfSplitError(
                    f"PDF chỉ có {total_pages} trang, nhưng phần {index} chọn đến trang {chunk.to_page}."
                )

            writer = PdfWriter()

            for page_index in range(chunk.from_page - 1, chunk.to_page):
                writer.add_page(reader.pages[page_index])

            output_buffer = BytesIO()
            writer.write(output_buffer)

            output_name = normalize_output_file_name(
                chunk.file_name,
                f"phan-{index}.pdf",
            )
            output_name = ensure_unique_file_name(output_name, used_names)
            used_names.add(output_name)

            zip_file.writestr(output_name, output_buffer.getvalue())

    zip_buffer.seek(0)
    return zip_buffer.getvalue()


def ensure_unique_file_name(file_name: str, used_names: set[str]) -> str:
    if file_name not in used_names:
        return file_name

    stem = file_name[:-4]
    suffix = ".pdf"
    counter = 2

    while f"{stem}-{counter}{suffix}" in used_names:
        counter += 1

    return f"{stem}-{counter}{suffix}"
