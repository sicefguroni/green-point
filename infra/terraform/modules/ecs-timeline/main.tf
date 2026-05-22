locals {
  tags       = merge(var.tags, { Name = var.service_name })
  log_prefix = "/ecs/${var.service_name}"
}

# ──────────── CloudWatch Log Group ────────────
resource "aws_cloudwatch_log_group" "this" {
  name              = local.log_prefix
  retention_in_days = var.log_retention_days
  tags              = local.tags
}

# ──────────── ECS Cluster ────────────
resource "aws_ecs_cluster" "this" {
  name = var.service_name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = local.tags
}

# ──────────── ECS Cluster Capacity Providers ────────────
resource "aws_ecs_cluster_capacity_providers" "this" {
  cluster_name = aws_ecs_cluster.this.name

  capacity_providers = distinct(concat(["FARGATE"], var.use_fargate_spot ? ["FARGATE_SPOT"] : []))

  default_capacity_provider_strategy {
    capacity_provider = var.use_fargate_spot ? "FARGATE_SPOT" : "FARGATE"
    weight            = 1
  }
}

# ──────────── Security Groups ────────────

# ALB Security Group
resource "aws_security_group" "alb" {
  name        = "${var.service_name}-alb"
  description = "Allow inbound traffic to the ALB"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP from internet"
    from_port   = var.alb_listener_port
    to_port     = var.alb_listener_port
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Role = "alb" })
}

# ECS Tasks Security Group
resource "aws_security_group" "ecs" {
  name        = "${var.service_name}-ecs"
  description = "Allow inbound traffic from ALB to ECS tasks"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Traffic from ALB"
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "HTTPS outbound (OpenAI API)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All other outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Role = "ecs" })
}

# ──────────── Application Load Balancer ────────────
resource "aws_lb" "this" {
  name               = substr(replace(var.service_name, "/[^a-zA-Z0-9-]/", ""), 0, 32)
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = false

  tags = local.tags
}

resource "aws_lb_target_group" "this" {
  name        = substr(replace(var.service_name, "/[^a-zA-Z0-9-]/", ""), 0, 32)
  port        = var.container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  health_check {
    enabled             = true
    path                = var.health_check_path
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  tags = local.tags

  depends_on = [aws_lb.this]
}

resource "aws_lb_listener" "this" {
  load_balancer_arn = aws_lb.this.arn
  port              = var.alb_listener_port
  protocol          = var.alb_listener_protocol

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this.arn
  }
}

# ──────────── Task Definition ────────────
locals {
  secret_entries = [
    for name, value_from in var.secret_environment_variables : {
      name      = name
      valueFrom = value_from
    }
  ]

  env_entries = [
    for name, value in var.environment_variables : {
      name  = name
      value = value
    }
  ]
}

resource "aws_ecs_task_definition" "this" {
  family                   = var.service_name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.container_cpu
  memory                   = var.container_memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = var.service_name
      image     = var.container_image
      essential = true
      cpu       = var.container_cpu
      memory    = var.container_memory
      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]
      environment = local.env_entries
      secrets     = local.secret_entries
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.this.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = var.service_name
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "curl -sf http://localhost:${var.container_port}${var.health_check_path} || exit 1"]
        interval    = 15
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }
    }
  ])

  lifecycle {
    create_before_destroy = true
  }

  tags = local.tags
}

data "aws_region" "current" {}

# ──────────── ECS Service ────────────
resource "aws_ecs_service" "this" {
  name            = var.service_name
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.this.arn
    container_name   = var.service_name
    container_port   = var.container_port
  }

  dynamic "capacity_provider_strategy" {
    for_each = var.use_fargate_spot ? [1] : []
    content {
      capacity_provider = "FARGATE_SPOT"
      weight            = 1
    }
  }

  dynamic "capacity_provider_strategy" {
    for_each = var.use_fargate_spot ? [] : [1]
    content {
      capacity_provider = "FARGATE"
      weight            = 1
    }
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    replace_triggered_by = [
      aws_ecs_task_definition.this.arn,
    ]
    ignore_changes = [
      task_definition,
      desired_count,
    ]
  }

  tags = local.tags
}
