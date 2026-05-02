FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir numpy==2.4.4
COPY bmp_io.py wiener.py /app/
CMD ["python3", "/app/wiener.py"]
