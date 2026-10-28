# TriBioNode Inference Backend (AWS S3 + FastAPI + Lambda)

This backend service loads your PyTorch model checkpoint from an AWS S3 bucket and serves a REST API endpoint (`POST /predict`) for the TriBioNode frontend.

---

## 1. Environment Variables

Configure these environment variables in AWS Lambda, ECS, or your `.env` file:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `S3_BUCKET_NAME` | Name of your AWS S3 bucket containing the model | `tribionode-models-bucket` |
| `S3_MODEL_KEY` | Path to the model file in S3 | `models/tribionode_best.pt` |
| `AWS_REGION` | AWS region where the bucket is hosted | `us-east-1` or `ap-south-1` |
| `ALLOWED_ORIGINS` | Permitted frontend origins (or `*`) | `http://localhost:5173,https://yourdomain.com` |

---

## 2. AWS IAM Permissions

The Lambda or ECS execution role needs read permissions for the S3 bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    }
  ]
}
```

---

## 3. How to Run Locally

```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn app:app --reload --port 8000
```

Open `http://127.0.0.1:8000/docs` to view Swagger API documentation.

---

## 4. API Endpoints

- `GET /health` — Check server health and S3 model loading status.
- `POST /predict` — Run multi-view solubility prediction.
  - Request: `{"smiles": "CC(=O)Oc1ccccc1C(=O)O"}`
  - Response: Predicted solubility for View 1, 2, 3, Fused, Gating weights, 2D SVG structure, and 3D conformer coordinates.
