# backend/Dockerfile

FROM python:3.11-slim

WORKDIR /app

# 依存パッケージをコピー
COPY requirements.txt .

# torchを含む依存パッケージをインストール
RUN pip install --no-cache-dir -r requirements.txt

# アプリ本体をコピー
COPY . .

# FastAPI起動
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
