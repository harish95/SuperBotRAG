variable "aws_region" {
  type        = string
  default     = "ap-south-1"
  description = "AWS region for resource deployment."
}

variable "app_name" {
  type        = string
  default     = "enterprise-rag"
  description = "Prefix name for all RAG chatbot infrastructure resources."
}

variable "image" {
  type        = string
  description = "Docker image with the FastAPI backend (used for both api and worker). Build + push this before terraform apply."
  default     = "harish95/superbotrag-backend:latest"
}

# ---- secrets ----

variable "openai_api_key" {
  type        = string
  sensitive   = true
  description = "API key for OpenAI models (embeddings and chat generation)."
}

variable "jwt_secret" {
  type        = string
  sensitive   = true
  description = "JWT signing secret. Generate with: openssl rand -hex 32"
}

variable "admin_email" {
  type        = string
  description = "Email of the admin account seeded on first start."
}

variable "admin_password" {
  type        = string
  sensitive   = true
  description = "Password for the seeded admin account. Must be >= 12 chars and not a known default (admin12345, change-me, password, admin)."

  validation {
    condition     = length(var.admin_password) >= 12 && !contains(["admin12345", "change-me", "password", "admin"], var.admin_password)
    error_message = "admin_password must be at least 12 characters and not a known default."
  }
}

variable "admin_full_name" {
  type        = string
  default     = "RAG Administrator"
  description = "Display name for the seeded admin."
}

# ---- qdrant ----

variable "qdrant_url" {
  type        = string
  default     = "https://78ffe17c-446c-492c-b0ea-99da2e1146e8.us-east-1-1.aws.cloud.qdrant.io"
  description = "Target Qdrant Cloud URL."
}

variable "qdrant_api_key" {
  type        = string
  sensitive   = true
  description = "API Key for Qdrant Cloud Cluster."
}

variable "qdrant_collection" {
  type        = string
  default     = "enterprise_rag"
  description = "Target collection name in Qdrant."
}
