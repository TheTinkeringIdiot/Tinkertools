# Build context: the repository root (see docker-compose.yml).
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

COPY backend/requirements.txt ./
RUN pip install -r requirements.txt

# The application, and what the data commands run by `docker compose exec`
# read: import_cli.py (load-legacy-ids), tools/verify_cas.py, database/.
COPY backend/ ./

RUN useradd --system --uid 1001 --no-create-home tinkertools
USER tinkertools
EXPOSE 8000
# Workers are sized in docker-compose.yml (WEB_CONCURRENCY); each holds a
# response cache of its own (backend/README.md, "Memory per worker").
# start-period covers the workers loading the store's revision facts.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)" || exit 1
CMD ["gunicorn", "app.main:app", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
