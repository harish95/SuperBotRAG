terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ==============================================================================
# 1. VPC NETWORKING (Optimized for Zero-Cost: Public Subnets only, No NAT Gateway)
# ==============================================================================

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = {
    Name = "${var.app_name}-vpc"
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_subnet" "public_1" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true
  tags = {
    Name = "${var.app_name}-public-subnet-1"
  }
}

resource "aws_subnet" "public_2" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = data.aws_availability_zones.available.names[1]
  map_public_ip_on_launch = true
  tags = {
    Name = "${var.app_name}-public-subnet-2"
  }
}

resource "aws_internet_gateway" "gw" {
  vpc_id = aws_vpc.main.id
  tags = {
    Name = "${var.app_name}-igw"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gw.id
  }
}

resource "aws_route_table_association" "public_1" {
  subnet_id      = aws_subnet.public_1.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_2" {
  subnet_id      = aws_subnet.public_2.id
  route_table_id = aws_route_table.public.id
}

# ==============================================================================
# 2. SECURITY GROUPS
# ==============================================================================

resource "aws_security_group" "alb" {
  name        = "${var.app_name}-alb-sg"
  description = "Controls access to Load Balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ecs_tasks" {
  name        = "${var.app_name}-tasks-sg"
  description = "Limits container access"
  vpc_id      = aws_vpc.main.id

  # Allow HTTP from Load Balancer
  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Allow internal container communications (Redis Stack & Service discovery)
  ingress {
    from_port = 0
    to_port   = 0
    protocol  = "-1"
    self      = true
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ==============================================================================
# 3. AWS COGNITO (IDENTITY PROVIDER)
# ==============================================================================

resource "aws_cognito_user_pool" "pool" {
  name = "${var.app_name}-user-pool"

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  schema {
    attribute_data_type = "String"
    name                = "role"
    mutable             = true
    string_attribute_constraints {
      min_length = 1
      max_length = 20
    }
  }

  auto_verified_attributes = ["email"]
}

resource "aws_cognito_user_pool_client" "client" {
  name         = "${var.app_name}-client"
  user_pool_id = aws_cognito_user_pool.pool.id
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]
}

# ==============================================================================
# 4. STORAGE & SQS
# ==============================================================================

# Documents Bucket
resource "aws_s3_bucket" "documents" {
  bucket        = "${var.app_name}-documents-testing"
  force_destroy = true # Auto-delete files on destroy for test stack
}

# Static Website Hosting Bucket (Frontend)
resource "aws_s3_bucket" "frontend" {
  bucket        = "${var.app_name}-frontend-static"
  force_destroy = true
}

resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  index_document {
    suffix = "index.html"
  }
  error_document {
    key = "index.html"
  }
}

# SQS Queue for Background Ingestion
resource "aws_sqs_queue" "ingestion_dlq" {
  name                      = "${var.app_name}-ingestion-dlq"
  message_retention_seconds = 86400 # 1 day for test
}

resource "aws_sqs_queue" "ingestion" {
  name                       = "${var.app_name}-ingestion-queue"
  visibility_timeout_seconds = 180
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.ingestion_dlq.arn
    maxReceiveCount     = 2
  })
}

# ==============================================================================
# 5. DYNAMODB TABLES (On-Demand / Free-tier eligible)
# ==============================================================================

resource "aws_dynamodb_table" "users" {
  name         = "enterprise-rag-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"

  attribute {
    name = "user_id"
    type = "S"
  }
  attribute {
    name = "email"
    type = "S"
  }

  global_secondary_index {
    name            = "email-index"
    hash_key        = "email"
    projection_type = "ALL"
  }
}

resource "aws_dynamodb_table" "documents" {
  name         = "enterprise-rag-documents"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "document_id"

  attribute {
    name = "document_id"
    type = "S"
  }
  attribute {
    name = "user_id"
    type = "S"
  }

  global_secondary_index {
    name            = "user-id-index"
    hash_key        = "user_id"
    projection_type = "ALL"
  }
}

resource "aws_dynamodb_table" "chat_logs" {
  name         = "enterprise-rag-chat-logs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"
  range_key    = "created_at"

  attribute {
    name = "user_id"
    type = "S"
  }
  attribute {
    name = "created_at"
    type = "S"
  }
}

# ==============================================================================
# 6. SSM PARAMETER STORE (Free Key Storage)
# ==============================================================================

resource "aws_ssm_parameter" "openai_key" {
  name        = "/rag/openai_api_key"
  type        = "SecureString"
  value       = var.openai_api_key
  description = "OpenAI API Key"
}

resource "aws_ssm_parameter" "qdrant_key" {
  name        = "/rag/qdrant_api_key"
  type        = "SecureString"
  value       = var.qdrant_api_key
  description = "Qdrant Cloud API Key"
}

resource "aws_ssm_parameter" "jwt_secret" {
  name        = "/rag/jwt_secret"
  type        = "SecureString"
  value       = var.jwt_secret
  description = "JWT signing secret"
}

resource "aws_ssm_parameter" "admin_password" {
  name        = "/rag/admin_password"
  type        = "SecureString"
  value       = var.admin_password
  description = "Seeded admin account password"
}

# ==============================================================================
# 7. IAM ROLE FOR CONTAINER EXECUTION
# ==============================================================================

resource "aws_iam_role" "ecs_execution_role" {
  name = "${var.app_name}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow reading secure parameters from SSM Parameter Store
resource "aws_iam_policy" "ssm_read" {
  name        = "${var.app_name}-ssm-read-policy"
  description = "Allows reading SecureString settings from Parameter Store"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["ssm:GetParameters", "ssm:GetParameter"]
      Resource = [
        aws_ssm_parameter.openai_key.arn,
        aws_ssm_parameter.qdrant_key.arn,
        aws_ssm_parameter.jwt_secret.arn,
        aws_ssm_parameter.admin_password.arn,
      ]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_ssm" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = aws_iam_policy.ssm_read.arn
}

resource "aws_iam_role" "ecs_task_role" {
  name = "${var.app_name}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_policy" "task_permissions" {
  name = "${var.app_name}-task-permissions-policy"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ],
        Resource = [
          aws_s3_bucket.documents.arn,
          "${aws_s3_bucket.documents.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:DescribeTable",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem"
        ],
        Resource = [
          aws_dynamodb_table.users.arn,
          aws_dynamodb_table.documents.arn,
          aws_dynamodb_table.chat_logs.arn,
          "${aws_dynamodb_table.users.arn}/index/*",
          "${aws_dynamodb_table.documents.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ],
        Resource = aws_sqs_queue.ingestion.arn
      },
      {
        Effect = "Allow"
        Action = [
          "sagemaker:InvokeEndpoint"
        ],
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:SignUp",
          "cognito-idp:AdminConfirmSignUp",
          "cognito-idp:InitiateAuth",
          "cognito-idp:AdminInitiateAuth"
        ],
        Resource = aws_cognito_user_pool.pool.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_permissions" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.task_permissions.arn
}

# ==============================================================================
# 8. ECS CLUSTER & PRIVATE SERVICE CONNECT (DNS redis.local)
# ==============================================================================

resource "aws_ecs_cluster" "cluster" {
  name = "${var.app_name}-cluster"
}

# Service Discovery Namespace
resource "aws_service_discovery_private_dns_namespace" "namespace" {
  name        = "local"
  description = "Private namespace"

  vpc = aws_vpc.main.id
}

# ==============================================================================
# 9. ECS SERVICES (API, Ingestion Worker, and Redis Stack Server)
# ==============================================================================

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${var.app_name}"
  retention_in_days = 1 # Keep log size minimal for testing
}

# 9a. Redis Stack Container Task & Service
resource "aws_ecs_task_definition" "redis" {
  family                   = "${var.app_name}-redis"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256 # 0.25 vCPU
  memory                   = 512 # 0.5 GB RAM
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn

  container_definitions = jsonencode([{
    name      = "redis"
    image     = "redis/redis-stack-server:latest"
    essential = true
    portMappings = [{
      containerPort = 6379
      hostPort      = 6379
    }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "redis"
      }
    }
  }])
}

resource "aws_ecs_service" "redis" {
  name            = "redis"
  cluster         = aws_ecs_cluster.cluster.id
  task_definition = aws_ecs_task_definition.redis.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public_1.id, aws_subnet.public_2.id]
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

  service_registries {
    registry_arn = aws_service_discovery_service.redis_dns.arn
  }
}

resource "aws_service_discovery_service" "redis_dns" {
  name = "redis"
  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.namespace.id
    dns_records {
      ttl  = 10
      type = "A"
    }
    routing_policy = "MULTIVALUE"
  }
  # No custom health check — ECS task lifecycle already controls
  # whether an instance is registered at all.
}

# 9b. FastAPI API Container Task & Service
resource "aws_ecs_task_definition" "api" {
  family                   = "${var.app_name}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 1024 # 1 vCPU
  memory                   = 2048 # 2 GB - required for sentence-transformers + unstructured
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([{
    name      = "api"
    image     = var.image
    essential = true
    portMappings = [{
      containerPort = 8000
      hostPort      = 8000
    }]
    environment = [
      { name = "ENVIRONMENT", value = "production" },
      { name = "QDRANT_URL", value = var.qdrant_url },
      { name = "QDRANT_COLLECTION", value = var.qdrant_collection },
      { name = "REDIS_URL", value = "redis://redis.local:6379" },
      { name = "COGNITO_USER_POOL_ID", value = aws_cognito_user_pool.pool.id },
      { name = "COGNITO_CLIENT_ID", value = aws_cognito_user_pool_client.client.id },
      { name = "S3_BUCKET", value = aws_s3_bucket.documents.id },
      { name = "AWS_REGION", value = var.aws_region },
      { name = "SQS_INGESTION_QUEUE_URL", value = aws_sqs_queue.ingestion.url },
      { name = "SAGEMAKER_RERANKER_ENDPOINT", value = "bge-reranker-endpoint" },
      { name = "DYNAMODB_USERS_TABLE", value = aws_dynamodb_table.users.name },
      { name = "DYNAMODB_DOCUMENTS_TABLE", value = aws_dynamodb_table.documents.name },
      { name = "DYNAMODB_CHAT_LOGS_TABLE", value = aws_dynamodb_table.chat_logs.name },
      { name = "DYNAMODB_AUTO_CREATE_TABLES", value = "false" },
      { name = "S3_AUTO_CREATE_BUCKET", value = "false" },
      { name = "ADMIN_EMAIL", value = var.admin_email },
      { name = "ADMIN_FULL_NAME", value = var.admin_full_name },
      { name = "CORS_ORIGINS", value = "https://${aws_cloudfront_distribution.cdn.domain_name},http://localhost:5173,http://localhost:3000" }
    ]
    secrets = [
      { name = "OPENAI_API_KEY", valueFrom = aws_ssm_parameter.openai_key.arn },
      { name = "QDRANT_API_KEY", valueFrom = aws_ssm_parameter.qdrant_key.arn },
      { name = "JWT_SECRET", valueFrom = aws_ssm_parameter.jwt_secret.arn },
      { name = "ADMIN_PASSWORD", valueFrom = aws_ssm_parameter.admin_password.arn }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "api"
      }
    }
  }])
}

resource "aws_ecs_service" "api" {
  name            = "api"
  cluster         = aws_ecs_cluster.cluster.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public_1.id, aws_subnet.public_2.id]
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.tg.arn
    container_name   = "api"
    container_port   = 8000
  }

  depends_on = [aws_lb_listener.listener, aws_ecs_service.redis]
}

# 9c. Ingestion Worker Container Task & Service
resource "aws_ecs_task_definition" "worker" {
  family                   = "${var.app_name}-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 512  # 0.5 vCPU
  memory                   = 1024 # 1 GB - lighter than API, no reranker startup
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([{
    name      = "worker"
    image     = var.image
    essential = true
    command   = ["python", "-m", "app.ingestion.worker"]
    environment = [
      { name = "ENVIRONMENT", value = "production" },
      { name = "QDRANT_URL", value = var.qdrant_url },
      { name = "QDRANT_COLLECTION", value = var.qdrant_collection },
      { name = "REDIS_URL", value = "redis://redis.local:6379" },
      { name = "COGNITO_USER_POOL_ID", value = aws_cognito_user_pool.pool.id },
      { name = "COGNITO_CLIENT_ID", value = aws_cognito_user_pool_client.client.id },
      { name = "S3_BUCKET", value = aws_s3_bucket.documents.id },
      { name = "AWS_REGION", value = var.aws_region },
      { name = "SQS_INGESTION_QUEUE_URL", value = aws_sqs_queue.ingestion.url },
      { name = "SAGEMAKER_RERANKER_ENDPOINT", value = "bge-reranker-endpoint" },
      { name = "DYNAMODB_USERS_TABLE", value = aws_dynamodb_table.users.name },
      { name = "DYNAMODB_DOCUMENTS_TABLE", value = aws_dynamodb_table.documents.name },
      { name = "DYNAMODB_CHAT_LOGS_TABLE", value = aws_dynamodb_table.chat_logs.name },
      { name = "DYNAMODB_AUTO_CREATE_TABLES", value = "false" },
      { name = "S3_AUTO_CREATE_BUCKET", value = "false" },
      { name = "ADMIN_EMAIL", value = var.admin_email },
      { name = "ADMIN_FULL_NAME", value = var.admin_full_name }
    ]
    secrets = [
      { name = "OPENAI_API_KEY", valueFrom = aws_ssm_parameter.openai_key.arn },
      { name = "QDRANT_API_KEY", valueFrom = aws_ssm_parameter.qdrant_key.arn },
      { name = "JWT_SECRET", valueFrom = aws_ssm_parameter.jwt_secret.arn },
      { name = "ADMIN_PASSWORD", valueFrom = aws_ssm_parameter.admin_password.arn }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "worker"
      }
    }
  }])
}

resource "aws_ecs_service" "worker" {
  name            = "worker"
  cluster         = aws_ecs_cluster.cluster.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public_1.id, aws_subnet.public_2.id]
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

  depends_on = [aws_ecs_service.redis]
}

# ==============================================================================
# 10. LOAD BALANCER (Routing HTTP requests to API Container)
# ==============================================================================

resource "aws_lb" "alb" {
  name               = "${var.app_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_1.id, aws_subnet.public_2.id]
}

resource "aws_lb_target_group" "tg" {
  name        = "${var.app_name}-tg"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/health/live"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "listener" {
  load_balancer_arn = aws_lb.alb.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tg.arn
  }
}

# ==============================================================================
# 11. CLOUDFRONT DISTRIBUTION (CDN fronting Frontend Bucket)
# ==============================================================================

resource "aws_cloudfront_origin_access_identity" "oai" {
  comment = "OAI access for static website bucket"
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { AWS = aws_cloudfront_origin_access_identity.oai.iam_arn }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.frontend.arn}/*"
    }]
  })
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewer"
}

resource "aws_cloudfront_distribution" "cdn" {
  origin {
    domain_name = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id   = "S3-Frontend"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.oai.cloudfront_access_identity_path
    }
  }

  origin {
    domain_name = aws_lb.alb.dns_name
    origin_id   = "ALB-Backend"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-Frontend"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  ordered_cache_behavior {
    path_pattern     = "auth/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-Backend"

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id

    viewer_protocol_policy = "redirect-to-https"
  }

  ordered_cache_behavior {
    path_pattern     = "health/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-Backend"

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id

    viewer_protocol_policy = "redirect-to-https"
  }

  ordered_cache_behavior {
    path_pattern     = "health"
    allowed_methods  = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-Backend"

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id

    viewer_protocol_policy = "redirect-to-https"
  }

  ordered_cache_behavior {
    path_pattern     = "upload/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-Backend"

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id

    viewer_protocol_policy = "redirect-to-https"
  }

  ordered_cache_behavior {
    path_pattern     = "documents"
    allowed_methods  = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-Backend"

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id

    viewer_protocol_policy = "redirect-to-https"
  }

  ordered_cache_behavior {
    path_pattern     = "documents/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-Backend"

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id

    viewer_protocol_policy = "redirect-to-https"
  }

  ordered_cache_behavior {
    path_pattern     = "chat/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-Backend"

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id

    viewer_protocol_policy = "redirect-to-https"
  }

  ordered_cache_behavior {
    path_pattern     = "admin/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-Backend"

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id

    viewer_protocol_policy = "redirect-to-https"
  }

  ordered_cache_behavior {
    path_pattern     = "logs"
    allowed_methods  = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-Backend"

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id

    viewer_protocol_policy = "redirect-to-https"
  }

  ordered_cache_behavior {
    path_pattern     = "docs"
    allowed_methods  = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-Backend"

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id

    viewer_protocol_policy = "redirect-to-https"
  }

  ordered_cache_behavior {
    path_pattern     = "openapi.json"
    allowed_methods  = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-Backend"

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id

    viewer_protocol_policy = "redirect-to-https"
  }

  ordered_cache_behavior {
    path_pattern     = "redoc"
    allowed_methods  = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-Backend"

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id

    viewer_protocol_policy = "redirect-to-https"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  tags = {
    Environment = "testing"
  }
}

# ==============================================================================
# OUTPUTS
# ==============================================================================

output "api_endpoint" {
  value       = "http://${aws_lb.alb.dns_name}"
  description = "Public URL of the backend FastAPI endpoint."
}

output "frontend_url" {
  value       = "https://${aws_cloudfront_distribution.cdn.domain_name}"
  description = "Public URL of the CloudFront static website frontend."
}

output "cognito_user_pool_id" {
  value       = aws_cognito_user_pool.pool.id
  description = "Cognito User Pool ID. Not wired into the API task (PBKDF2 auth is used instead) but provisioned for future use."
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.client.id
}

output "frontend_bucket" {
  value       = aws_s3_bucket.frontend.id
  description = "S3 bucket name for the React build. After terraform apply, run: aws s3 sync ./frontend/dist s3://<bucket>/"
}

output "documents_bucket" {
  value = aws_s3_bucket.documents.id
}
