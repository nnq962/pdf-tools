## PDF Tool Backend

FastAPI backend for splitting uploaded PDF files into multiple output PDFs.

### Install

```bash
cd backend
uv sync
```

### Run

```bash
cd backend
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Health Check

```bash
curl http://127.0.0.1:8000/health
```
