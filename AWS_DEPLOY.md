# 1-Day AWS Test Deployment (Low-Cost)

Cheapest realistic path: **one EC2 instance running the existing `docker-compose.yml`**, talking to **real DynamoDB + S3** (both within free tier), with Redis Stack + Qdrant kept as local containers.

Total cost: **~$1 for a 24-hour test** (EC2 only). Stop the instance when done.

## Cost breakdown

| Component | Choice | Cost (24 h) |
|---|---|---|
| EC2 t3.medium (2 vCPU, 4 GB) | On-demand | ~$1.00 |
| EBS 30 GB gp3 | | ~$0.08 |
| DynamoDB | PAY_PER_REQUEST, free-tier 25 GB / 25 R+W per sec | **$0** |
| S3 | free-tier 5 GB + 2 k PUT / 20 k GET | **$0** |
| CloudWatch Logs | free-tier 5 GB | **$0** |
| Data egress | < 100 MB at typical test load | **$0** |
| **Total** | | **~$1.10** |

Skipping (for cost): ALB ($0.55/day), NAT Gateway ($1+/day), Route 53 ($0.50/zone), WAF, Secrets Manager. Use the EC2 public DNS and put secrets directly in `.env` on the host.

t3.medium needed because the backend image (sentence-transformers + unstructured + tesseract) needs >2 GB resident. t3.micro (1 GB) will OOM. If staying strictly within 12-month free tier, see "Alternative" at the end.

---

## Step 1 — Pre-create the AWS resources

**S3 bucket** (real, free tier):
```bash
aws s3 mb s3://rag-test-$(whoami)-$(date +%s) --region us-east-1
# Save the bucket name. Example: rag-test-haris-1747000000
```

**DynamoDB tables** — let the app auto-create them on first start (keep `DYNAMODB_AUTO_CREATE_TABLES=true` for this test).

**IAM user for the EC2** (or attach an instance role — preferred):
- Create IAM user `rag-test`, programmatic access.
- Attach inline policy scoped to the bucket + DDB tables:
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      { "Effect": "Allow",
        "Action": ["s3:GetObject","s3:PutObject","s3:DeleteObject","s3:ListBucket","s3:HeadBucket","s3:CreateBucket"],
        "Resource": ["arn:aws:s3:::rag-test-YOUR-BUCKET","arn:aws:s3:::rag-test-YOUR-BUCKET/*"] },
      { "Effect": "Allow",
        "Action": ["dynamodb:*"],
        "Resource": "arn:aws:dynamodb:us-east-1:*:table/enterprise-rag-*" }
    ]
  }
  ```
- Save the access key + secret.

(Better path: skip the IAM user, attach the same policy as an **EC2 instance profile** so the host gets temp credentials with no secrets in `.env`. Below uses the simpler IAM-user path for a 1-day test.)

## Step 2 — Launch the EC2

```bash
aws ec2 run-instances \
  --image-id ami-0c02fb55956c7d316 \              # Amazon Linux 2023, us-east-1
  --instance-type t3.medium \
  --key-name YOUR_KEY \
  --security-groups rag-test-sg \
  --block-device-mappings 'DeviceName=/dev/xvda,Ebs={VolumeSize=30,VolumeType=gp3}' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=rag-test}]'
```

Create the security group `rag-test-sg` with inbound:
- 22 from your IP (SSH)
- 80 from anywhere (frontend)
- 8000 from anywhere (backend API for testing)

## Step 3 — Bootstrap the host

SSH in, install Docker + compose:

```bash
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
# log out / back in
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

## Step 4 — Copy the repo + write `.env`

```bash
# From your laptop:
rsync -avz --exclude node_modules --exclude .venv --exclude .git \
  ./ ec2-user@<EC2_DNS>:~/rag/
```

On the EC2, create `~/rag/.env` (real values, no quotes):

```ini
ENVIRONMENT=production

# Strong secrets — generate with: openssl rand -hex 32
JWT_SECRET=<openssl rand -hex 32>

# Admin account (must be ≥ 12 chars in production)
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=<at least 12 chars, not a known default>
ADMIN_FULL_NAME=RAG Administrator

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_CHAT_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_DIMENSIONS=1536

# Guardrails
GUARDRAILS_ENABLED=true
GUARDRAILS_MODEL=gpt-4o-mini
GUARDRAILS_MAX_INPUT_CHARS=2000
GUARDRAILS_MIN_RETRIEVED_DOCS=1
GUARDRAILS_BLOCK_PII_OUTPUT=true
GUARDRAILS_FAIL_OPEN=true

# Real AWS for DynamoDB + S3
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET=rag-test-YOUR-BUCKET    # the bucket from Step 1
S3_ENDPOINT_URL=                  # empty = real AWS S3
S3_USE_SSL=true
S3_AUTO_CREATE_BUCKET=false       # already created

# Real DynamoDB
DYNAMODB_USERS_TABLE=enterprise-rag-users
DYNAMODB_CHAT_LOGS_TABLE=enterprise-rag-chat-logs
DYNAMODB_DOCUMENTS_TABLE=enterprise-rag-documents
DYNAMODB_ENDPOINT_URL=            # empty = real AWS
DYNAMODB_AUTO_CREATE_TABLES=true  # let the app create on first start

# Local Redis Stack + Qdrant containers (free, ephemeral)
REDIS_URL=redis://redis:6379
QDRANT_URL=http://qdrant:6333
QDRANT_API_KEY=

REDIS_CACHE_INDEX=faq_cache_idx
REDIS_CACHE_PREFIX=faq:
REDIS_CACHE_TTL_SECONDS=86400
REDIS_CACHE_DISTANCE_THRESHOLD=0.12
QDRANT_COLLECTION=enterprise_rag
QDRANT_PREFER_GRPC=false
SPARSE_MODEL=Qdrant/bm25
RERANKER_MODEL=BAAI/bge-reranker-base

PARENT_CHUNK_SIZE=1800
PARENT_CHUNK_OVERLAP=200
CHILD_CHUNK_SIZE=400
CHILD_CHUNK_OVERLAP=60
RETRIEVAL_TOP_K=12
RERANK_TOP_N=4

ACCESS_TOKEN_EXPIRE_MINUTES=120
# Lock CORS to the EC2 public DNS or your own domain:
CORS_ORIGINS=http://<EC2_PUBLIC_DNS>
```

## Step 5 — Override Docker for real AWS

Since we want real DDB + S3 (no local containers for them), remove the `dynamodb` and `minio` services for this deploy. Create `docker-compose.aws.yml` on the EC2:

```yaml
services:
  backend:
    env_file:
      - .env
    environment:
      # Local container endpoints stay overridden for Redis + Qdrant.
      # Empty DYNAMODB_ENDPOINT_URL / S3_ENDPOINT_URL → real AWS.
      REDIS_URL: redis://redis:6379
      QDRANT_URL: http://qdrant:6333
      QDRANT_API_KEY: ""
      DYNAMODB_ENDPOINT_URL: ""
      S3_ENDPOINT_URL: ""
      AWS_REGION: us-east-1
    depends_on: [redis, qdrant]

  dynamodb:
    profiles: ["never"]   # disabled
  minio:
    profiles: ["never"]   # disabled
```

Build + run:

```bash
cd ~/rag
# Build frontend with the production API URL baked in:
docker build --build-arg VITE_API_URL=http://<EC2_PUBLIC_DNS>:8000 -t rag-frontend ./frontend
docker compose -f docker-compose.yml -f docker-compose.aws.yml up -d --build
```

## Step 6 — Smoke-test

```bash
curl http://<EC2_PUBLIC_DNS>:8000/health/live    # → {"status":"ok"}
curl http://<EC2_PUBLIC_DNS>:8000/health/ready   # → all services "ok"
```

Open `http://<EC2_PUBLIC_DNS>/` in a browser. Log in as the admin email + password from `.env`.

## Step 7 — Tear down (when the test is over)

```bash
aws ec2 terminate-instances --instance-ids i-...
aws s3 rb s3://rag-test-YOUR-BUCKET --force
aws dynamodb delete-table --table-name enterprise-rag-users
aws dynamodb delete-table --table-name enterprise-rag-chat-logs
aws dynamodb delete-table --table-name enterprise-rag-documents
```

Then revoke the IAM user's access key.

---

## What this deployment skips (intentionally, to keep cost low)

| Skipped | Cost saved | Acceptable risk for 1-day test? |
|---|---|---|
| ALB + HTTPS termination | ~$0.55/day | Yes for HTTP test. Don't input real production data. |
| Route 53 + ACM cert | ~$0.50/zone/month | Yes. Use EC2 DNS. |
| WAF | ~$0.20/day + per-request | Yes. The rate limiting in code provides minimal protection. |
| NAT Gateway | ~$1.10/day | Yes. EC2 in public subnet. |
| Secrets Manager | $0.40/secret/month | Yes. Secrets in `.env` on a single host you control. |
| MemoryDB for Redis | ~$0.60/day | Yes. Container Redis is ephemeral but the test won't restart. |
| Multi-AZ | varies | Yes. Single host for a single day. |

## Security caveats for the test window

1. The site is **HTTP**, not HTTPS. Don't enter passwords you care about.
2. Anyone who finds the public IP can reach the login page. Rate limiting (5 logins/minute) helps but is per-IP — easily evaded by a botnet. **Don't leave it up overnight.**
3. `ENVIRONMENT=production` enforces strong `ADMIN_PASSWORD` (≥12 chars, not a known default) and `JWT_SECRET` (not "change-me"). If startup refuses, fix the values.
4. `OPENAI_API_KEY` is on the host. Set a low monthly cap in the OpenAI dashboard before deploying.

---

## Alternative: stricter free-tier path (only DDB + S3 + EC2)

If you must stay within the 12-month free tier:
- Replace t3.medium with **t3.micro** (free tier 750 h/month). Backend will likely OOM with the reranker enabled — disable the reranker (`RERANKER_MODEL=`) and accept lower retrieval quality.
- Or run only the backend + frontend in containers, and replace Redis Stack with **DynamoDB-backed cache** (different code path — not provided; would need a small refactor).
- Or use **App Runner** (~$0.16/day idle, scales with traffic). Single-service only, so you'd need to host Redis + Qdrant somewhere else (Redis Cloud free tier 30 MB; Qdrant Cloud free 1 GB cluster).

For a 1-day test, paying ~$1 for t3.medium is the cleanest option.
