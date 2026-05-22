locals {
  tags = merge(var.tags, { Name = var.service_name })
}

# ──────────── Assume role policy (shared by both roles) ────────────
data "aws_iam_policy_document" "ecs_task_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# ──────────── Task Role ────────────
resource "aws_iam_role" "task" {
  name               = "${var.service_name}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json
  description        = "Task role for ${var.service_name} ECS tasks"

  tags = merge(local.tags, { Role = "task" })
}

# Policy: Read Secrets Manager secrets
data "aws_iam_policy_document" "read_secrets" {
  count = length(var.secret_arns) > 0 ? 1 : 0

  statement {
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = var.secret_arns
  }
}

resource "aws_iam_policy" "read_secrets" {
  count  = length(var.secret_arns) > 0 ? 1 : 0
  name   = "${var.service_name}-read-secrets"
  policy = data.aws_iam_policy_document.read_secrets[0].json

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "read_secrets" {
  count      = length(var.secret_arns) > 0 ? 1 : 0
  role       = aws_iam_role.execution.name
  policy_arn = aws_iam_policy.read_secrets[0].arn
}

# ──────────── Execution Role ────────────
resource "aws_iam_role" "execution" {
  name               = "${var.service_name}-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json
  description        = "Execution role for ${var.service_name} ECS tasks"

  tags = merge(local.tags, { Role = "execution" })
}

# Attach the AWS-managed ECS task execution policy
resource "aws_iam_role_policy_attachment" "execution_base" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Policy: ECR pull
data "aws_iam_policy_document" "ecr_pull" {
  count = length(var.ecr_repository_arns) > 0 ? 1 : 0

  statement {
    effect = "Allow"
    actions = [
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:BatchCheckLayerAvailability",
    ]
    resources = var.ecr_repository_arns
  }

  statement {
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "ecr_pull" {
  count  = length(var.ecr_repository_arns) > 0 ? 1 : 0
  name   = "${var.service_name}-ecr-pull"
  policy = data.aws_iam_policy_document.ecr_pull[0].json

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "execution_ecr_pull" {
  count      = length(var.ecr_repository_arns) > 0 ? 1 : 0
  role       = aws_iam_role.execution.name
  policy_arn = aws_iam_policy.ecr_pull[0].arn
}
