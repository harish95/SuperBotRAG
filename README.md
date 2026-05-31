# SuperBotRAG: Enterprise Retrieval-Augmented Generation Platform

SuperBotRAG is a production-ready, highly secure, and cost-optimized Enterprise Retrieval-Augmented Generation (RAG) platform. It features a modern, responsive React chat interface, a robust FastAPI backend, asynchronous document parsing and ingestion pipelines, vector search indexing, and a semantic cache to reduce LLM token usage and latency.

---

## 🚀 Key Features

*   **Asynchronous Processing**: Scalable document ingestion decoupled using **Amazon SQS** queues and processed by an autonomous **ECS Fargate Worker** task.
*   **Semantic Document Parsing**: Intelligent chunking (Parent-Child layout) and extraction utilizing Unstructured, storing embedded representations in a vector database.
*   **Hybrid Vector Search**: Combines dense vector similarity with sparse BM25 keyword matching via **Qdrant Cloud** for high precision retrieval.
*   **Semantic Caching**: Utilizes **Redis Stack** similarity scoring to cache user query-answer pairs, cutting costs and lowering response times for repeating queries.
*   **Production Security Hardening**: 
    *   Secure environment variable management using **AWS Systems Manager (SSM) Parameter Store** (no secrets stored in git or containers).
    *   State-of-the-art authentication using JWT tokens and PBKDF2 SHA-256 credential hashing (600,000 iterations).
    *   Edge routing and HTTPS termination via **Amazon CloudFront** + **Application Load Balancer (ALB)**, bypassing CORS limitations.

---

## 📂 Repository Structure

The project is structured as a monorepo containing the following components:

```
├── backend/                  # FastAPI python backend API service
├── frontend/                 # React / Vite / TypeScript single-page app
├── deploy/                   # Infrastructure configuration & scripts
│   ├── terraform/            # Terraform configurations (VPC, ECS, CloudFront, ALB)
│   └── sagemaker_deploy.py   # SageMaker endpoint rollout script for models
├── SYSTEM_DESIGN.md          # Architectural blueprints, network design, & pipelines
├── TROUBLESHOOTING.md        # Incident history runbook (CORS, 500/504s, SageMaker OOMs)
├── APPLY_TERRAFORM.md        # Guide for deploying using Terraform IaC
├── AWS_DEPLOY.md             # Guide for deploying using AWS CLI
└── AWS_DEPLOY_CONSOLE.md     # Guide for deploying manually via AWS Web Console
```

For a detailed walkthrough of the system architecture, data flows, and network topology, see the [System Design Document](file:///d:/AI/SuperChatbot/SuperBotCodex/SYSTEM_DESIGN.md).

---

## 🛠️ Local Development Setup

To run the entire platform locally inside Docker containers with emulated AWS services (MinIO for S3, DynamoDB Local for databases):

### 1. Prerequisites
*   [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.
*   An [OpenAI API Key](https://platform.openai.com/signup) for embeddings and LLM completions.

### 2. Configure Environment Variables
Copy the example environment file and fill in your OpenAI key:
```bash
cp .env.example .env
```
Open `.env` and configure:
*   `OPENAI_API_KEY`: Your real OpenAI API Key.
*   Ensure other database endpoints point to the internal Docker Compose services (pre-configured).

### 3. Run the Stack
Build and launch the containers:
```bash
docker compose up -d --build
```

The services will initialize:
*   **Frontend**: `http://localhost:5173`
*   **Backend API**: `http://localhost:8000` (docs available at `/docs`)
*   **MinIO Console**: `http://localhost:9001` (login: `minioadmin` / `minioadmin`)
*   **Redis Stack Console**: `http://localhost:8001`

To shut down the local stack and wipe database volume attachments:
```bash
docker compose down -v
```

---

## ☁️ AWS Cloud Deployment

We provide three guides for deploying this stack on AWS (defaulting to the low-cost, zero-NAT public gateway subnet configuration in region `ap-south-1`):

1.  **Infrastructure as Code (IaC)**: Deploy the entire secure cluster in ~10 minutes using [Terraform Deployment Guide](file:///d:/AI/SuperChatbot/SuperBotCodex/APPLY_TERRAFORM.md).
2.  **AWS Console GUI**: Build it step-by-step in the AWS UI using [AWS Console Deployment Guide](file:///d:/AI/SuperChatbot/SuperBotCodex/AWS_DEPLOY_CONSOLE.md).
3.  **AWS CLI Scripting**: Build using CLI commands with [AWS CLI Deployment Guide](file:///d:/AI/SuperChatbot/SuperBotCodex/AWS_DEPLOY.md).

---

## 📋 Runbooks & Maintenance

*   **System Blueprint**: For database schemas, network diagrams, and pipeline sequences, read [SYSTEM_DESIGN.md](file:///d:/AI/SuperChatbot/SuperBotCodex/SYSTEM_DESIGN.md).
*   **Troubleshooting Guide**: If you encounter CORS issues, 504 Gateway Timeouts, document processing bottlenecks, or SageMaker deployment errors, consult [TROUBLESHOOTING.md](file:///d:/AI/SuperChatbot/SuperBotCodex/TROUBLESHOOTING.md).
