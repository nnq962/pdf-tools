from __future__ import annotations

import json
import os
import re
from io import BytesIO
from urllib.parse import quote

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, ValidationError

from app.services.pdf_splitter import (
    PdfChunk,
    PdfSplitError,
    get_pdf_page_count,
    split_pdf_to_zip,
)


class SplitChunkPayload(BaseModel):
    file_name: str = Field(alias="fileName", min_length=1)
    from_page: int = Field(alias="fromPage", ge=1)
    to_page: int = Field(alias="toPage", ge=1)


def parse_cors_origins() -> list[str]:
    raw_origins = os.getenv(
        "PDF_TOOL_CORS_ORIGINS",
        "http://127.0.0.1:5173,http://localhost:5173",
    )

    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


def create_split_zip_file_name(source_file_name: str) -> str:
    base_name = re.sub(r"\.pdf$", "", source_file_name.strip(), flags=re.IGNORECASE)
    base_name = re.sub(r'[\\/:*?"<>|]+', "-", base_name)
    base_name = re.sub(r"\s+", " ", base_name).strip(" .")

    if not base_name:
        base_name = "pdf"

    return f"{base_name}-split.zip"


app = FastAPI(title="PDF Tool API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=parse_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/pdf/page-count")
async def pdf_page_count(file: UploadFile = File(...)) -> dict[str, int]:
    source_file_name = file.filename or ""

    if (
        file.content_type != "application/pdf"
        and not source_file_name.lower().endswith(".pdf")
    ):
        raise HTTPException(status_code=400, detail="Vui lòng tải lên tệp PDF.")

    pdf_bytes = await file.read()

    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Tệp PDF đang trống.")

    try:
        page_count = get_pdf_page_count(pdf_bytes)
    except PdfSplitError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {"pageCount": page_count}


@app.post("/pdf/split")
async def split_pdf(
    file: UploadFile = File(...),
    chunks: str = Form(...),
) -> StreamingResponse:
    source_file_name = file.filename or ""

    if (
        file.content_type != "application/pdf"
        and not source_file_name.lower().endswith(".pdf")
    ):
        raise HTTPException(status_code=400, detail="Vui lòng tải lên tệp PDF.")

    try:
        raw_chunks = json.loads(chunks)
        payload_chunks = [SplitChunkPayload.model_validate(chunk) for chunk in raw_chunks]
    except (json.JSONDecodeError, TypeError, ValidationError) as exc:
        raise HTTPException(
            status_code=400,
            detail="Danh sách phần tách chưa hợp lệ.",
        ) from exc

    pdf_bytes = await file.read()

    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Tệp PDF đang trống.")

    split_chunks = [
        PdfChunk(
            file_name=chunk.file_name,
            from_page=chunk.from_page,
            to_page=chunk.to_page,
        )
        for chunk in payload_chunks
    ]

    try:
        zip_bytes = split_pdf_to_zip(pdf_bytes, split_chunks)
    except PdfSplitError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    download_name = create_split_zip_file_name(source_file_name)
    encoded_download_name = quote(download_name)

    return StreamingResponse(
        BytesIO(zip_bytes),
        media_type="application/zip",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{download_name}"; '
                f"filename*=UTF-8''{encoded_download_name}"
            ),
        },
    )
