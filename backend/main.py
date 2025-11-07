from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import torch
import torch.nn as nn
import numpy as np

app = FastAPI()

# CORS許可
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- モデル定義 ---
class RouteNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Linear(4, 16),
            nn.ReLU(),
            nn.Linear(16, 8),
            nn.ReLU(),
            nn.Linear(8, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        return self.layers(x)

# モデルロード
model = RouteNet()
model.load_state_dict(torch.load("models/route_nn_model.pth", map_location=torch.device("cpu")))
model.eval()

class RouteData(BaseModel):
    coordinates: list  # [{lanes, curvature, intersection_density, elevation_diff}]

@app.post("/ai/route-diagnosis-dl")
async def route_diagnosis_dl(data: RouteData):
    features = []
    for pt in data.coordinates:
        lanes = float(pt.get("lanes", 1))
        curvature = float(pt.get("curvature", 0))
        density = float(pt.get("intersection_density", 1))
        elevation = float(pt.get("elevation_diff", 0))
        features.append([lanes, curvature, density, elevation])

    X = torch.tensor(features, dtype=torch.float32)
    with torch.no_grad():
        preds = model(X).numpy().flatten()

    avg_score = float(np.mean(preds))
    level = (
        "快適" if avg_score > 0.7 else
        "注意" if avg_score > 0.4 else
        "危険"
    )

    return {
        "status": "ok",
        "avg_score": round(avg_score, 3),
        "level": level,
        "predictions": preds.tolist(),
    }
