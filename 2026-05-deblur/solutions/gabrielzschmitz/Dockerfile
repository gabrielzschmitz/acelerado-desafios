FROM python:3.11-slim

ENV PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN pip install --no-cache-dir numpy

COPY solution.py /app/solution.py

CMD ["python3", "-B", "/app/solution.py"]
