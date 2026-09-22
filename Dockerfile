FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/*.py backend/Procfile backend/runtime.txt ./
COPY backend/data ./data
COPY backend/media ./media
COPY backend/static ./static

ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080} --workers ${UVICORN_WORKERS:-2}"]
