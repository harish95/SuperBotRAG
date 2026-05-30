# 1-Day AWS Test Deployment — Console-Only Steps

Region used throughout: **Mumbai (ap-south-1)** (matches your `.env`).

After every screen, look at the top-right region selector and confirm it still says **Asia Pacific (Mumbai) ap-south-1** — switching regions silently is the #1 cause of "where did my resource go?" issues.

---

## Step 1 — Create the S3 bucket

**Console path:** S3 → "Create bucket"

| Field | Value |
|---|---|
| Bucket name | `rag-documents-hbx` (must match `S3_BUCKET` in your `.env`) |
| AWS Region | Asia Pacific (Mumbai) ap-south-1 |
| Object Ownership | ACLs disabled (Bucket owner enforced) — default |
| Block Public Access | **Block all public access** — keep checked |
| Bucket Versioning | Disable (free tier saves storage) |
| Default encryption | SSE-S3 (default) |
| Advanced settings | Leave all defaults |

Click **Create bucket**.

Verify: open the bucket → it should be empty.

---

## Step 2 — Create the IAM user for the EC2 backend

**Console path:** IAM → Users → "Create user"

1. **User name:** `rag-test-backend`
2. **Provide user access to the AWS Management Console:** **No** (programmatic only)
3. Click **Next**
4. **Permissions options:** Attach policies directly → **Create policy** (opens a new tab)

### 2a. Create the inline policy

In the policy editor, click **JSON** tab and paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3RagBucket",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:HeadBucket"
      ],
      "Resource": [
        "arn:aws:s3:::rag-documents-hbx",
        "arn:aws:s3:::rag-documents-hbx/*"
      ]
    },
    {
      "Sid": "DynamoDBRagTables",
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable",
        "dynamodb:DescribeTable",
        "dynamodb:ListTables",
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchWriteItem",
        "dynamodb:BatchGetItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:ap-south-1:*:table/enterprise-rag-*",
        "arn:aws:dynamodb:ap-south-1:*:table/enterprise-rag-*/index/*"
      ]
    }
  ]
}
```

Click **Next**, name it `rag-test-policy`, click **Create policy**. Close that tab.

### 2b. Back on the user-creation tab

- Refresh the policy list, search for `rag-test-policy`, tick it.
- Click **Next**, then **Create user**.

### 2c. Generate the access key

- Open the new user → **Security credentials** tab → **Create access key**
- Use case: **Application running outside AWS** → Next → Create access key
- **Copy both the Access key ID and Secret access key now.** The secret is shown only once.

Keep them — these become `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in your EC2's `.env`.

---

## Step 3 — Create an EC2 key pair for SSH

**Console path:** EC2 → Network & Security → Key Pairs → "Create key pair"

| Field | Value |
|---|---|
| Name | `rag-test-key` |
| Key pair type | RSA |
| Private key file format | `.pem` (OpenSSH) |

Click **Create key pair**. The browser will download `rag-test-key.pem`. Save it somewhere safe — you can't re-download it.

On Windows PowerShell, set ACLs so SSH will accept it. Note the `${env:USERNAME}` braces — without them PowerShell's parser eats the trailing colon and `icacls` sees `(R)` as a separate argument.

```powershell
$keyPath = "$HOME\Downloads\rag-test-key.pem"
icacls $keyPath /reset
icacls $keyPath /inheritance:r
icacls $keyPath /grant:r "${env:USERNAME}:(R)"
icacls $keyPath                            # verify
```

(On Mac/Linux: `chmod 400 ~/Downloads/rag-test-key.pem`.)

---

## Step 4 — Create the security group

**Console path:** EC2 → Network & Security → Security Groups → "Create security group"

| Field | Value |
|---|---|
| Name | `rag-test-sg` |
| Description | `1-day RAG test` |
| VPC | default VPC (top of the list) |

**Inbound rules** (Add rule × 3):

| Type | Protocol | Port | Source | Description |
|---|---|---|---|---|
| SSH | TCP | 22 | My IP | SSH from your laptop |
| HTTP | TCP | 80 | Anywhere-IPv4 (0.0.0.0/0) | Frontend |
| Custom TCP | TCP | 8000 | Anywhere-IPv4 (0.0.0.0/0) | Backend API |

**Outbound rules:** leave the default "all traffic to 0.0.0.0/0".

Click **Create security group**.

> The "My IP" option auto-fills your current public IP. If your IP changes (cafe Wi-Fi etc.) you'll need to edit this rule.

---

## Step 5 — Launch the EC2 instance

**Console path:** EC2 → Instances → "Launch instances"

| Field | Value |
|---|---|
| Name and tags | Name = `rag-test` |
| Application and OS Images (AMI) | **Amazon Linux 2023** (first result, "Free tier eligible" label) |
| Architecture | 64-bit (x86) |
| Instance type | **t3.medium** (2 vCPU, 4 GB) — NOT free-tier, but ~$1/day in ap-south-1 |
| Key pair (login) | `rag-test-key` (from Step 3) |
| Network settings → Firewall (security groups) | **Select existing** → `rag-test-sg` |
| Configure storage | 30 GiB, gp3 (default) |
| Advanced details | Leave defaults |

Click **Launch instance**.

After ~30 seconds the instance shows **Running** in the Instances list. Click it and copy:

- **Public IPv4 DNS** — looks like `ec2-13-127-XXX-YYY.ap-south-1.compute.amazonaws.com`
- **Public IPv4 address** — looks like `13.127.XXX.YYY`

You'll need both below.

---

## Step 6 — SSH into the EC2 and install Docker

From PowerShell on your laptop:

```powershell
ssh -i $HOME\Downloads\rag-test-key.pem ec2-user@<EC2_PUBLIC_DNS>
```

Type `yes` at the host-key prompt. You're now on the EC2.

Run on the EC2:

```bash
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user

# Docker Compose v2 plugin:
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

exit                # log out so the new docker group takes effect
```

SSH back in:

```powershell
ssh -i $HOME\Downloads\rag-test-key.pem ec2-user@<EC2_PUBLIC_DNS>
```

Verify:

```bash
docker version           # client + server both shown, no permission error
docker compose version   # v2.x
```

---

## Step 7 — Copy the project to the EC2

From a **second** PowerShell tab on your laptop (don't disturb the SSH session):

```powershell
cd D:\AI\SuperChatbot\SuperBotCodex

# Copy everything except heavyweight dirs:
scp -i $HOME\Downloads\rag-test-key.pem -r `
  backend frontend docker-compose.yml AWS_DEPLOY.md `
  ec2-user@<EC2_PUBLIC_DNS>:~/rag/
```

(If `scp` is unhappy with the recursive copy on Windows, install **WinSCP** for a GUI, or use `rsync` from WSL.)

On the EC2:

```bash
ls ~/rag           # should show backend/  frontend/  docker-compose.yml  AWS_DEPLOY.md
```

---

## Step 8 — Write the production `.env` on the EC2

On the EC2:

```bash
cd ~/rag
nano .env
```

Paste this — **replace every `<...>` placeholder** with real values:

```ini
ENVIRONMENT=production

# Generate JWT_SECRET with: openssl rand -hex 32
JWT_SECRET=<paste-the-64-hex-string-here>

# Admin account — password must be >= 12 chars (the production check enforces this)
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=<at-least-12-chars-and-not-a-known-default>
ADMIN_FULL_NAME=RAG Administrator

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_CHAT_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_DIMENSIONS=1536

# Guardrails (cheap classifier)
GUARDRAILS_ENABLED=true
GUARDRAILS_MODEL=gpt-4o-mini
GUARDRAILS_MAX_INPUT_CHARS=2000
GUARDRAILS_MIN_RETRIEVED_DOCS=1
GUARDRAILS_BLOCK_PII_OUTPUT=true
GUARDRAILS_FAIL_OPEN=true

# Real AWS for DDB + S3 — from Step 2c
AWS_ACCESS_KEY_ID=<paste-access-key-id>
AWS_SECRET_ACCESS_KEY=<paste-secret-access-key>
AWS_REGION=ap-south-1
S3_BUCKET=rag-documents-hbx
S3_ENDPOINT_URL=
S3_USE_SSL=true
S3_AUTO_CREATE_BUCKET=false

DYNAMODB_USERS_TABLE=enterprise-rag-users
DYNAMODB_CHAT_LOGS_TABLE=enterprise-rag-chat-logs
DYNAMODB_DOCUMENTS_TABLE=enterprise-rag-documents
DYNAMODB_ENDPOINT_URL=
DYNAMODB_AUTO_CREATE_TABLES=true

# Local Redis Stack + Qdrant containers (free, ephemeral)
REDIS_URL=redis://redis:6379
REDIS_CACHE_INDEX=faq_cache_idx
REDIS_CACHE_PREFIX=faq:
REDIS_CACHE_TTL_SECONDS=86400
REDIS_CACHE_DISTANCE_THRESHOLD=0.12

QDRANT_URL=http://qdrant:6333
QDRANT_API_KEY=
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
CORS_ORIGINS=http://<EC2_PUBLIC_DNS>
```

Save: `Ctrl+O`, `Enter`, `Ctrl+X`.

> **Generate JWT_SECRET:** on the EC2 run `openssl rand -hex 32` and paste the output.

---

## Step 9 — Disable the local DDB and MinIO services in compose

The committed `docker-compose.yml` runs a local `dynamodb` and `minio`. We want real AWS instead.

On the EC2:

```bash
cd ~/rag
nano docker-compose.aws.yml
```

Paste:

```yaml
services:
  backend:
    env_file:
      - .env
    environment:
      REDIS_URL: redis://redis:6379
      QDRANT_URL: http://qdrant:6333
      QDRANT_API_KEY: ""
      DYNAMODB_ENDPOINT_URL: ""
      S3_ENDPOINT_URL: ""
      AWS_REGION: ap-south-1
    depends_on:
      - redis
      - qdrant

  dynamodb:
    profiles: ["never"]
  minio:
    profiles: ["never"]
```

Save and exit.

---

## Step 10 — Build the frontend with the right API URL, then start everything

On the EC2:

```bash
cd ~/rag

# Bake the production API URL into the React bundle:
docker build --build-arg VITE_API_URL=http://<EC2_PUBLIC_DNS>:8000 -t rag-frontend ./frontend

# Build backend + start the stack (no DDB, no MinIO containers — real AWS instead):
docker compose -f docker-compose.yml -f docker-compose.aws.yml up -d --build
```

First run takes 5–15 minutes (large backend image with sentence-transformers + unstructured + tesseract). Watch progress:

```bash
docker compose logs -f backend
```

You're ready when you see:
```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

`Ctrl+C` to detach from logs (the container keeps running because of `-d`).

---

## Step 11 — Smoke-test

From your laptop:

```powershell
curl http://<EC2_PUBLIC_IP>:8000/health/live
# → {"status":"ok"}

curl http://<EC2_PUBLIC_IP>:8000/health/ready
# → all services should show "ok"
```

Open `http://<EC2_PUBLIC_DNS>/` in a browser. Log in with the admin email + password from your `.env`. Upload a small PDF, ask a question.

While you're testing, watch:

- **S3 Console** → `rag-documents-hbx` → keys should appear under `documents/<user_id>/...`
- **DynamoDB Console** → Tables → you should see `enterprise-rag-users`, `enterprise-rag-chat-logs`, `enterprise-rag-documents` auto-created on first login/upload.

---

## Step 12 — Tear down (when the test is over)

To keep the bill at ~$1, **don't leave the EC2 running overnight.**

**Console path:** EC2 → Instances → select `rag-test` → Instance state →

- **Stop instance** — pauses billing for compute (EBS keeps charging, ~$0.08/day). Safe if you want to resume later.
- **Terminate instance** — permanent deletion, EBS also released. Use this when fully done.

Other clean-up:

| Resource | Console path | What to do |
|---|---|---|
| S3 bucket | S3 → `rag-documents-hbx` | Empty bucket, then Delete bucket |
| DynamoDB tables | DynamoDB → Tables | Delete each `enterprise-rag-*` table |
| IAM access key | IAM → Users → `rag-test-backend` → Security credentials | Make access key inactive, then Delete |
| IAM user | IAM → Users → `rag-test-backend` | Delete user (after removing keys) |
| Key pair | EC2 → Key Pairs → `rag-test-key` | Delete |
| Security group | EC2 → Security Groups → `rag-test-sg` | Delete (after EC2 is terminated) |

---

## Cost reminder

| Item | ap-south-1 / 24 h |
|---|---|
| EC2 t3.medium | ~₹86 (~$1.04) |
| EBS 30 GB gp3 | ~₹7 (~$0.08) |
| DynamoDB | Free tier (25 GB + 25 RCU/WCU) |
| S3 | Free tier (5 GB + 2k PUT + 20k GET) |
| Data egress | < ₹10 for typical test load |
| **Total** | **~₹100 (~$1.20)** |

---

## Troubleshooting cheatsheet

| Symptom | Likely cause | Fix |
|---|---|---|
| `RuntimeError: ADMIN_PASSWORD must be...` at startup | Production check rejecting weak password | Edit `.env`, set ≥ 12-char password, `docker compose up -d` again |
| Backend container restart loop | OpenAI key wrong / quota exceeded | `docker compose logs backend` |
| `403 Forbidden` from S3 | IAM policy mismatch on bucket name | Re-check Step 2a JSON — bucket name in two ARNs |
| `ProvisionedThroughputExceededException` from DDB | Free tier exceeded | Test load is below 25 R/W per second; check no infinite loop |
| Frontend loads but API calls fail | `VITE_API_URL` not baked into build | Rebuild: Step 10's `docker build --build-arg ...` |
| "No space left on device" | Docker images filled 30 GB | `docker system prune -af` |

If chat returns errors mentioning the OpenAI model, change `OPENAI_CHAT_MODEL` to `gpt-4.1-mini` or `gpt-4o-mini` in `.env`, then `docker compose restart backend`.
