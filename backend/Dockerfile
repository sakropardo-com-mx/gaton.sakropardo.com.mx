FROM python:3.11-slim

# Install unrar from official rarlab binaries and ffmpeg for audio transcoding
RUN apt-get update && apt-get install -y wget curl ffmpeg && \
    wget https://www.rarlab.com/rar/rarlinux-x64-700.tar.gz && \
    tar -zxvf rarlinux-x64-700.tar.gz && \
    cp rar/unrar /usr/local/bin/ && \
    rm -rf rar rarlinux-x64-700.tar.gz && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
