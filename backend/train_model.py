import torch
import torch.nn as nn
import torch.optim as optim
import pandas as pd

# CSV読み込み
df = pd.read_csv("data/training_data.csv")

X = torch.tensor(df[["lanes", "curvature", "intersection_density", "elevation_diff"]].values, dtype=torch.float32)
y = torch.tensor(df["score"].values, dtype=torch.float32).view(-1, 1)

# モデル定義
class RouteNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Linear(4, 16),
            nn.ReLU(),
            nn.Linear(16, 8),
            nn.ReLU(),
            nn.Linear(8, 1),
            nn.Sigmoid()  # 0〜1のスコア
        )

    def forward(self, x):
        return self.layers(x)

model = RouteNet()
criterion = nn.MSELoss()
optimizer = optim.Adam(model.parameters(), lr=0.01)

# 学習ループ
for epoch in range(500):
    optimizer.zero_grad()
    outputs = model(X)
    loss = criterion(outputs, y)
    loss.backward()
    optimizer.step()
    if epoch % 100 == 0:
        print(f"Epoch [{epoch}/500] Loss: {loss.item():.4f}")

torch.save(model.state_dict(), "models/route_nn_model.pth")
print("✅ モデル保存完了: models/route_nn_model.pth")
