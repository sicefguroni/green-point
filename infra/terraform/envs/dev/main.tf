provider "aws" {
  region  = var.aws_region
  profile = "terraform-tf"

  default_tags {
    tags = {
      Project     = "GreenPoint"
      Service     = "TimelineSwarm"
      Environment = "dev"
      ManagedBy   = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}

# ──────────── VPC ────────────
module "vpc" {
  source = "../../modules/vpc"

  name               = "greenpoint-timeline-swarm"
  cidr_block         = var.vpc_cidr
  availability_zones = var.availability_zones
  nat_gateway_count  = 1
}

# ──────────── ECR ────────────
module "ecr" {
  source = "../../modules/ecr"

  name            = "greenpoint-timeline-swarm"
  max_image_count = 5
  scan_on_push    = true
}

# ──────────── Secrets ────────────
module "secrets" {
  source = "../../modules/secrets"

  secrets = {
    "greenpoint/timeline-swarm/openai-key" = {
      description = "OpenAI API key for the GreenPoint Timeline Swarm service"
    }
    "greenpoint/timeline-swarm/database-url" = {
      description = "Postgres connection string for LangGraph checkpoint store (Supabase direct connection)"
    }
    "greenpoint/timeline-swarm/openai-model" = {
      description = "OpenAI model name for the Timeline Swarm LLM calls (e.g. gpt-5.4-mini)"
    }
    "greenpoint/timeline-swarm/langgraph-strict-msgpack" = {
      description = "Enables strict MessagePack serialization for LangGraph checkpoints"
    }
  }
}

# ──────────── IAM ────────────
module "iam" {
  source = "../../modules/iam"

  service_name        = "greenpoint-timeline-swarm"
  secret_arns         = values(module.secrets.secret_arns)
  ecr_repository_arns = [module.ecr.repository_arn]
}

# ──────────── ECS Timeline Service ────────────
module "ecs" {
  source = "../../modules/ecs-timeline"

  service_name       = "greenpoint-timeline-swarm"
  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnet_ids
  private_subnet_ids = module.vpc.private_subnet_ids

  container_image  = "${module.ecr.repository_url}:${var.container_image_tag}"
  container_port   = 8001
  container_cpu    = var.ecs_cpu
  container_memory = var.ecs_memory
  desired_count    = var.desired_count

  task_role_arn      = module.iam.task_role_arn
  execution_role_arn = module.iam.execution_role_arn

  environment_variables = {
    CORS_ORIGINS = join(",", var.cors_origins)
  }

  secret_environment_variables = {
    OPENAI_API_KEY              = module.secrets.secret_ids["greenpoint/timeline-swarm/openai-key"]
    TIMELINE_SWARM_DATABASE_URL = module.secrets.secret_ids["greenpoint/timeline-swarm/database-url"]
    OPENAI_TIMELINE_MODEL       = module.secrets.secret_ids["greenpoint/timeline-swarm/openai-model"]
    LANGGRAPH_STRICT_MSGPACK    = module.secrets.secret_ids["greenpoint/timeline-swarm/langgraph-strict-msgpack"]
  }

  use_fargate_spot  = true
  alb_listener_port = 80
}
