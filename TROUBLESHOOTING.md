# Troubleshooting Guide — SuperBotRAG (Enterprise RAG on AWS)

This document records all deployment and runtime issues encountered while rolling out the Enterprise RAG platform on AWS, along with their root causes and resolutions.

---

## Table of Contents

1. [Mixed Content Error (HTTPS/HTTP)](#1-mixed-content-error-httpshttp)
2. [Network Error on Login](#2-network-error-on-login)
3. [Documents Stuck in "Processing" State](#3-documents-stuck-in-processing-state)
4. [500 Internal Server Error on Chat Queries](#4-500-internal-server-error-on-chat-queries)
5. [504 Gateway Timeout on Chat Queries](#5-504-gateway-timeout-on-chat-queries)
6. [SageMaker Serverless Memory Quota Limit](#6-sagemaker-serverless-memory-quota-limit)
7. [AWS STS InvalidClientTokenId Error](#7-aws-sts-invalidclienttokenid-error)

---

## 1. Mixed Content Error (HTTPS/HTTP)

**Symptom:**
```
Mixed Content: The page at 'https://d3gj5hr29wscps.cloudfront.net/register' was loaded
over HTTPS, but requested an insecure XMLHttpRequest endpoint
'http://enterprise-rag-alb-1624398217.ap-south-1.elb.amazonaws.com/auth/register'.
This request has been blocked; the content must be served over HTTPS.
```

**Root Cause:**
The frontend was configured to call the backend API over the ALB's HTTP endpoint directly (`http://...elb.amazonaws.com`), while the frontend itself was served over HTTPS via CloudFront. Browsers block mixed HTTP/HTTPS content.

**Resolution:**
- Configured CloudFront to proxy API requests through the same HTTPS distribution.
- Updated the frontend's `VITE_API_URL` to use the CloudFront URL (`https://d3gj5hr29wscps.cloudfront.net`) instead of the ALB URL directly.
- CloudFront behavior pattern `/api/*`, `/auth/*`, `/health/*`, `/documents/*`, `/upload/*`, `/chat/*` routes to the ALB origin.

---

## 2. Network Error on Login

**Symptom:**
Login page throws a generic "Network Error" when submitting credentials, with no HTTP response received.

**Root Cause:**
Two issues combined:
1. **CORS misconfiguration** — the backend's `CORS_ORIGINS` did not include the CloudFront distribution URL.
2. **Mixed content** — browser was blocking the HTTP API request from the HTTPS frontend page (see issue #1).

**Resolution:**
- Added `https://d3gj5hr29wscps.cloudfront.net` to the `CORS_ORIGINS` environment variable in the ECS task definition.
- Routed all API traffic through CloudFront (see issue #1 resolution).

---

## 3. Documents Stuck in "Processing" State

**Symptom:**
After uploading documents via the UI, the status shows "Processing" indefinitely. However, the files were successfully uploaded and visible in the S3 bucket (`enterprise-rag-documents-testing`).

**Root Cause:**
The ingestion worker processes documents by pulling them from the SQS queue, parsing, chunking, embedding, and storing in Qdrant. The worker was experiencing issues connecting to downstream services (Qdrant, OpenAI) during embedding/indexing, but the upload (S3 + DynamoDB metadata) succeeded.

**Resolution:**
- Verified the worker ECS service was running and connected to the correct SQS queue.
- Ensured the worker task definition had all required environment variables (Qdrant URL/API key, OpenAI API key via SSM).
- Force-redeployed the worker service to pick up the corrected configuration.
- Documents then processed successfully.

---

## 4. 500 Internal Server Error on Chat Queries

**Symptom:**
```
Something went wrong
Request failed with status code 500
```
When asking questions in the chatbot interface.

**Root Cause:**
The backend's `.env` file (used for local/Docker development) contains MinIO credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`). The `get_settings()` function calls `load_dotenv(override=True)`, which injects these MinIO credentials into `os.environ`, overriding the IAM role credentials provided by ECS Fargate. This caused `boto3` clients (S3, DynamoDB, SQS, SageMaker) to use invalid MinIO credentials instead of the task role.

**Resolution:**
- The Docker image was rebuilt to not include the `.env` file.
- Ensured the `ENVIRONMENT=production` setting skips loading `.env` overrides.
- All AWS credentials are now sourced from the ECS Task IAM Role (`enterprise-rag-ecs-task-role`).

---

## 5. 504 Gateway Timeout on Chat Queries

**Symptom:**
```
Something went wrong
Request failed with status code 504
```
Queries that reached the backend timed out after ~30 seconds.

**Root Cause:**
This was a **cascading timeout** caused by the SageMaker Reranker endpoint:

1. The backend calls `sagemaker-runtime.invoke_endpoint()` to rerank retrieved documents using `bge-reranker-endpoint`.
2. The SageMaker Serverless endpoint was configured with **3GB RAM**, which is insufficient for loading the `BAAI/bge-reranker-base` PyTorch model.
3. SageMaker threw `ModelError: Inference failed due to insufficient memory` and entered a container restart loop.
4. During container restarts, SageMaker holds incoming requests for up to **60 seconds**.
5. This blocked the uvicorn worker in Fargate, exceeding **CloudFront's 30-second origin response timeout**, resulting in a 504.

**Resolution:**
- **Disabled the SageMaker reranker** by setting `SAGEMAKER_RERANKER_ENDPOINT=""` in both the `api` and `worker` ECS task definitions.
- Registered new task definition revisions (`enterprise-rag-api:4`, `enterprise-rag-worker:5`).
- Force-redeployed both services.
- The backend now falls back to returning the top-N retrieved documents without reranking, which still provides good results using hybrid (dense + sparse) retrieval from Qdrant.
- Deleted the broken SageMaker resources (endpoint, config, model) to avoid costs.

**Future Fix:**
Request an AWS Service Quota increase for *"Memory size in MB per serverless endpoint"* from 3072 MB to 6144 MB in `ap-south-1`, then redeploy the SageMaker endpoint with 6GB RAM.

---

## 6. SageMaker Serverless Memory Quota Limit

**Symptom:**
```
ResourceLimitExceeded: The account-level service limit 'Memory size in MB per serverless
endpoint' is 3072 MBs, with current utilization of 0 MBs and a request delta of 6144 MBs.
```

**Root Cause:**
The AWS account's default service quota for SageMaker Serverless Inference limits each endpoint to **3072 MB** (3GB) maximum. The `bge-reranker-base` model requires more than 3GB to load its PyTorch weights.

**Resolution:**
- Disabled the reranker as a workaround (see issue #5).
- To re-enable, submit a Service Quota increase request via the AWS Console:
  1. Go to **Service Quotas** → **Amazon SageMaker**
  2. Search for *"Memory size in MB per serverless endpoint"*
  3. Request increase to **6144** (6GB)
  4. Once approved, redeploy using `deploy/sagemaker_deploy.py` (update `memory_size_in_mb` to `6144`)

---

## 7. AWS STS InvalidClientTokenId Error

**Symptom:**
```
InvalidClientTokenId: The security token included in the request is invalid.
```
When running `aws sts get-caller-identity` locally.

**Root Cause:**
The `.env` file contained MinIO credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) meant for local development with MinIO (S3-compatible storage). When `load_dotenv(override=True)` was called, these credentials were injected into the environment, overriding the valid AWS CLI profile credentials.

**Resolution:**
- Ensured local development uses the `.env.example` as a template with placeholder values.
- The production Docker image does not include `.env`.
- For local AWS CLI usage, either:
  - Comment out `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `.env`
  - Or use `--profile` flag with a named AWS CLI profile

---

## Quick Reference: Environment Variables

| Variable | Purpose | Where Set |
|----------|---------|-----------|
| `SAGEMAKER_RERANKER_ENDPOINT` | SageMaker reranker endpoint name (set to `""` to disable) | ECS Task Definition |
| `CORS_ORIGINS` | Allowed origins for CORS | ECS Task Definition |
| `OPENAI_API_KEY` | OpenAI API key for embeddings & completions | SSM Parameter Store |
| `QDRANT_API_KEY` | Qdrant Cloud API key | SSM Parameter Store |
| `JWT_SECRET` | JWT signing secret | SSM Parameter Store |
| `ADMIN_PASSWORD` | Admin user password | SSM Parameter Store |

## Architecture Quick Reference

```
User → CloudFront (HTTPS) → ALB (HTTP) → ECS Fargate (api/worker/redis)
                                              ↓
                                    Qdrant Cloud (vectors)
                                    DynamoDB (metadata, users, chat logs)
                                    S3 (document storage)
                                    SQS (ingestion queue)
                                    OpenAI (embeddings + LLM)
                                    SageMaker (reranker - currently disabled)
```
