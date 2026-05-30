# Tier 3 Deployment — Apply `deploy/terraform/`

Provisions: VPC + ALB + ECS Fargate (api, worker, redis tasks) + DynamoDB + S3 documents bucket + S3+CloudFront for the frontend + SQS+DLQ for async ingestion + Cognito User Pool + SSM Parameter Store for secrets + CloudWatch logs.

Expected runtime cost in ap-south-1: **~$2.50–4/day** (mostly ALB + 3 Fargate tasks). Free tier covers DDB, S3, SQS, Cognito for this scale.

Region used: **ap-south-1** (Mumbai) — matches `variables.tf` default and your `.env`.

> Terraform doesn't need the `aws` CLI binary — it talks to AWS directly via env vars. So your broken CLI isn't a blocker here.

---

## Step 0 — Prerequisites on your laptop

1. **Terraform** (Windows install):

   ```powershell
   # Easiest: via Chocolatey
   choco install terraform -y

   # Or via winget
   winget install -e --id Hashicorp.Terraform

   # Verify
   terraform -version    # → Terraform v1.5+ expected
   ```

2. **Docker Desktop** running (you already have this for `docker compose`).

3. **A Docker Hub account** (free, https://hub.docker.com/signup) — ECS will pull the backend image from here. You can use ECR instead but it requires the CLI; Docker Hub avoids that.

4. **A `power-user` IAM user with broad permissions** — the existing `rag-test-backend` only has S3 + DDB, not enough for Terraform. Console-create a new one:

   - IAM → Users → Create user → name `rag-terraform-admin`
   - Permissions: **Attach policies directly** → check `AdministratorAccess`
   - Create user → open it → Security credentials → **Create access key** (Application running outside AWS) → save the two strings.

   This is a 1-day key; delete the user when you're done (Step 8 below).

---

## Step 1 — Configure AWS credentials for Terraform (PowerShell session-only)

```powershell
$env:AWS_ACCESS_KEY_ID     = "AKIA..."
$env:AWS_SECRET_ACCESS_KEY = "..."
$env:AWS_DEFAULT_REGION    = "ap-south-1"
```

These only apply to the current PowerShell window — they don't persist or write to disk.

---

## Step 2 — Build + push the backend image to Docker Hub

The Terraform points ECS at a Docker Hub image. We need to push the **current code** (with all the AWS hardening — `slowapi`, magic bytes, content-hash idempotency, PBKDF2 600 k, etc.), not the antigravity-built `harish95/superbotrag-backend:latest` which is stale.

```powershell
cd D:\AI\SuperChatbot\SuperBotCodex

# Log in to Docker Hub:
docker login          # username = your hub.docker.com handle, password / token

# Build for linux/amd64 (Fargate is x86_64). On Windows Docker Desktop this is default.
docker build -t <your-dockerhub-user>/superbotrag-backend:latest .\backend

# Push (1–2 GB image, takes 5–15 min depending on uplink):
docker push <your-dockerhub-user>/superbotrag-backend:latest
```

Verify on https://hub.docker.com/r/<your-dockerhub-user>/superbotrag-backend that the tag exists and `latest` is recent.

> If you don't want a public image, you'd need ECR + a registry credential secret in the task def — that's another half-hour of plumbing. For a 1-day test, public Docker Hub is fine; the image contains no secrets (all secrets come from SSM at runtime).

---

## Step 3 — Set Terraform variables

```powershell
cd D:\AI\SuperChatbot\SuperBotCodex\deploy\terraform
Copy-Item terraform.tfvars.example terraform.tfvars
notepad terraform.tfvars
```

Fill in every field. Required:

```hcl
aws_region = "ap-south-1"

image = "<your-dockerhub-user>/superbotrag-backend:latest"

openai_api_key = "sk-..."
qdrant_api_key = "eyJ..."          # copy from your local .env
jwt_secret     = "<openssl rand -hex 32 output>"

admin_email     = "you@example.com"
admin_password  = "..."             # must be >= 12 chars and not "admin12345" etc.
admin_full_name = "RAG Administrator"
```

Generate `jwt_secret` from the EC2 you launched earlier, or any Linux box:

```bash
openssl rand -hex 32
```

(`terraform.tfvars` is git-ignored — see the updated `.gitignore`.)

---

## Step 4 — Terraform init, plan, apply

```powershell
cd D:\AI\SuperChatbot\SuperBotCodex\deploy\terraform

# Downloads the AWS provider (~120 MB) into .terraform/
terraform init

# Dry run — shows every resource it WILL create. Review the count.
terraform plan
# Expect ~45 resources to be added.

# Apply — actually creates resources. Type "yes" at the prompt.
terraform apply
```

`terraform apply` takes **5–10 minutes** because of:
- VPC + subnets (~30 s)
- ALB provisioning (~3 min)
- CloudFront distribution (~3–5 min) — the slowest piece
- ECS service stabilisation (~2–3 min, pulling 1–2 GB image)

When it finishes, you'll see outputs like:

```
api_endpoint         = "http://enterprise-rag-alb-XXXX.ap-south-1.elb.amazonaws.com"
frontend_url         = "https://dxxxxxxxxxxxxx.cloudfront.net"
frontend_bucket      = "enterprise-rag-frontend-..."
documents_bucket     = "enterprise-rag-documents-..."
cognito_user_pool_id = "ap-south-1_xxxxxxxxx"
cognito_client_id    = "xxxxxxxxxxxxxxxxxxxx"
```

**Copy the `api_endpoint` and `frontend_bucket`** — Step 5 needs them.

---

## Step 5 — Build and upload the frontend

The React bundle needs to know the API URL **at build time** (it's baked into the JS). Use the `api_endpoint` from Step 4:

```powershell
cd D:\AI\SuperChatbot\SuperBotCodex\frontend

# Clean install if you don't have node_modules:
npm ci

# Build with the ALB URL baked in:
$env:VITE_API_URL = "http://enterprise-rag-alb-XXXX.ap-south-1.elb.amazonaws.com"
npm run build

# Upload to the frontend S3 bucket from terraform output:
# (uses AWS env vars from Step 1; if your aws CLI is truly broken,
#  use the S3 Console: drag dist/* into the bucket.)
aws s3 sync .\dist s3://<frontend_bucket>/ --delete

# Invalidate CloudFront cache so it picks up the new bundle immediately:
$DISTRIBUTION_ID = (terraform -chdir=..\deploy\terraform output -raw frontend_url) -replace "https://" -replace "\.cloudfront\.net"
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"
```

**If `aws` CLI is broken** — alternative for the upload step:
1. S3 Console → open the `enterprise-rag-frontend-...` bucket → Upload → drag the contents of `frontend\dist\` (not the folder itself, the files inside) → Upload.
2. CloudFront Console → Distributions → click the distribution → Invalidations → Create invalidation → path `/*`.

---

## Step 6 — Smoke test

1. Hit the API: `curl http://<api_endpoint>/health/live` → `{"status":"ok"}`
2. Hit the readiness check: `curl http://<api_endpoint>/health/ready` → all services `"ok"`
3. Open the `frontend_url` in a browser (the CloudFront URL — HTTPS).
4. Log in with `admin_email` + `admin_password` from `terraform.tfvars`.
5. Upload a small PDF, ask a question.

Watch logs:

- CloudWatch Console → Log groups → `/ecs/enterprise-rag` → streams prefixed `api`, `worker`, `redis`.

Common 1st-time issues:

| Symptom | Cause | Fix |
|---|---|---|
| ECS api task keeps restarting | Image pull / OOM / startup error | CloudWatch logs → look for `OOMKilled`, OpenAI key issue, or Redis not yet ready (auto-retries handle this within ~30 s) |
| Frontend loads, login returns CORS error | `CORS_ORIGINS` mismatch | Re-run `terraform apply` to refresh task env, or hard-edit task def in ECS Console |
| 503 from ALB for the first ~3 min | ECS task still starting | Wait. Watch target group health in EC2 → Target Groups |
| `ConditionalCheckFailedException` on first chat | DDB tables not yet existing | Tables are created by TF, not by app. If you see this, terraform apply didn't finish. |

---

## Step 7 — When the test is done: `terraform destroy`

```powershell
cd D:\AI\SuperChatbot\SuperBotCodex\deploy\terraform
terraform destroy   # type "yes"
```

This removes everything Terraform created **in reverse order**. Takes ~5 min (CloudFront distribution takes a few minutes to delete).

**Two things Terraform won't tear down automatically:**

1. **Objects inside S3 buckets** — `terraform destroy` fails on non-empty buckets. Either empty them first via S3 Console (`Empty bucket` button on each of the two buckets), or add `force_destroy = true` to the bucket resources (not recommended — accidental data loss risk).
2. **CloudWatch log streams** — retention is 1 day; they self-expire.

After destroy:

- Verify in the Billing dashboard that no Fargate / ALB charges accrue overnight.
- Console-delete the `rag-terraform-admin` IAM user from Step 0.
- Console-deactivate and delete its access key.

---

## What you've avoided (intentionally) vs Tier 1

| Concern | Tier 1 (EC2) | Tier 3 (this) |
|---|---|---|
| Scaling | None | ECS Fargate tasks; can bump `desired_count` on the api service for horizontal scale |
| HTTPS | No (HTTP only) | Yes for frontend (CloudFront default cert); API is still HTTP via ALB — for HTTPS API you'd add an ACM cert |
| Logs | In-process deque | CloudWatch Logs (`/ecs/enterprise-rag`) |
| Secret storage | `.env` file on host | SSM Parameter Store SecureStrings, fetched at task start |
| State on restart | EC2 reboot wipes Redis/Qdrant cache | Same — local Redis task is still ephemeral. Qdrant is on Qdrant Cloud so it persists. |
| Auth | PBKDF2 + seeded admin | PBKDF2 + seeded admin (Cognito provisioned but unused) |
| Async ingestion | Synchronous (request blocks) | SQS → worker (request returns 202 immediately) |
| Cost / 24 h | ~$1 | ~$2.50–4 |

---

## Things to know about the Terraform itself

- The 6 fixes I just made to `main.tf` (CPU/memory bump, Qdrant secret fix, Cognito env-var removal, ENVIRONMENT/JWT/admin/CORS env vars, health check path, parameterized image) are required for the apply to succeed. Without them, apply errors out or services crash on boot.
- Cognito resources are created but **not wired into the API task** — auth uses PBKDF2 via the seeded admin. If you want Cognito later, re-add `COGNITO_USER_POOL_ID` + `COGNITO_CLIENT_ID` env vars to the api task def.
- The async ingestion path (worker task + SQS) **activates** because `SQS_INGESTION_QUEUE_URL` is set in the API env. Uploads write to S3 + DDB then publish to SQS; the worker picks up and processes. Confirm by watching `worker` log stream after an upload.
- The Redis Fargate task is single-replica and ephemeral — its data is lost on restart. That's fine for FAQ cache (it just rebuilds). Don't use this for any data that must persist.
- The reranker model still downloads at api task startup from HuggingFace (~400 MB, adds ~1 min to cold start). The `sagemaker_deploy.py` script in the repo would move it to a SageMaker Serverless endpoint, but the code doesn't actually call it (the `_build_reranker` method always runs locally). Ignore that script for now.
