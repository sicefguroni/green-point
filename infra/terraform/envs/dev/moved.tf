# ──────────── State Migration: moved blocks ────────────
#
# These blocks tell Terraform that resources previously created by the
# flat configuration in `infra/terraform/` are now managed by the new
# module structure in `infra/terraform/envs/dev/`.
#
# How to apply:
#   1. cd infra/terraform/envs/dev
#   2. terraform init         (if uncommented backend, add -migrate)
#   3. terraform plan         (should show 0 to create, 0 to destroy)
#   4. terraform apply        (updates state addresses, no resource changes)
#
# If you get errors about resource instances not found in state, some
# resources may not have been created yet — the moved block is a no-op
# for resources that don't exist in state.
#
# To remove these blocks after migration is complete:
#   rm infra/terraform/envs/dev/moved.tf
#   terraform plan   (should show 0 changes)

# ────── VPC module ──────
moved {
  from = aws_vpc.this
  to   = module.vpc.aws_vpc.this
}
moved {
  from = aws_internet_gateway.this
  to   = module.vpc.aws_internet_gateway.this
}
moved {
  from = aws_subnet.public
  to   = module.vpc.aws_subnet.public
}
moved {
  from = aws_subnet.private
  to   = module.vpc.aws_subnet.private
}
moved {
  from = aws_eip.nat
  to   = module.vpc.aws_eip.nat
}
moved {
  from = aws_nat_gateway.this
  to   = module.vpc.aws_nat_gateway.this
}
moved {
  from = aws_route_table.public
  to   = module.vpc.aws_route_table.public
}
moved {
  from = aws_route_table.private
  to   = module.vpc.aws_route_table.private
}
moved {
  from = aws_route_table_association.public
  to   = module.vpc.aws_route_table_association.public
}
moved {
  from = aws_route_table_association.private
  to   = module.vpc.aws_route_table_association.private
}
moved {
  from = aws_default_security_group.this
  to   = module.vpc.aws_default_security_group.this
}

# ────── ECR module ──────
moved {
  from = aws_ecr_repository.this
  to   = module.ecr.aws_ecr_repository.this
}
moved {
  from = aws_ecr_lifecycle_policy.this
  to   = module.ecr.aws_ecr_lifecycle_policy.this
}

# ────── Secrets module ──────
# Old flat config used count-based secrets; new module uses for_each
moved {
  from = aws_secretsmanager_secret.openai_key[0]
  to   = module.secrets.aws_secretsmanager_secret.new["greenpoint/timeline-swarm/openai-key"]
}
moved {
  from = aws_secretsmanager_secret.database_url[0]
  to   = module.secrets.aws_secretsmanager_secret.new["greenpoint/timeline-swarm/database-url"]
}

# ────── IAM module ──────
moved {
  from = aws_iam_role.task
  to   = module.iam.aws_iam_role.task
}
moved {
  from = aws_iam_role.execution
  to   = module.iam.aws_iam_role.execution
}
moved {
  from = aws_iam_policy.read_secrets
  to   = module.iam.aws_iam_policy.read_secrets
}
moved {
  from = aws_iam_policy.ecr_pull
  to   = module.iam.aws_iam_policy.ecr_pull
}
moved {
  from = aws_iam_role_policy_attachment.read_secrets
  to   = module.iam.aws_iam_role_policy_attachment.read_secrets
}
moved {
  from = aws_iam_role_policy_attachment.execution_base
  to   = module.iam.aws_iam_role_policy_attachment.execution_base
}
moved {
  from = aws_iam_role_policy_attachment.execution_ecr_pull
  to   = module.iam.aws_iam_role_policy_attachment.execution_ecr_pull
}

# ────── ECS Timeline module ──────
# Note: the environment composition uses `source = "../../modules/ecs-timeline"`
# and is referenced as `module.ecs` in envs/dev/main.tf
moved {
  from = aws_cloudwatch_log_group.this
  to   = module.ecs.aws_cloudwatch_log_group.this
}
moved {
  from = aws_ecs_cluster.this
  to   = module.ecs.aws_ecs_cluster.this
}
moved {
  from = aws_ecs_cluster_capacity_providers.this
  to   = module.ecs.aws_ecs_cluster_capacity_providers.this
}
moved {
  from = aws_security_group.alb
  to   = module.ecs.aws_security_group.alb
}
moved {
  from = aws_security_group.ecs
  to   = module.ecs.aws_security_group.ecs
}
moved {
  from = aws_lb.this
  to   = module.ecs.aws_lb.this
}
moved {
  from = aws_lb_target_group.this
  to   = module.ecs.aws_lb_target_group.this
}
moved {
  from = aws_lb_listener.this
  to   = module.ecs.aws_lb_listener.this
}
moved {
  from = aws_ecs_task_definition.this
  to   = module.ecs.aws_ecs_task_definition.this
}
moved {
  from = aws_ecs_service.this
  to   = module.ecs.aws_ecs_service.this
}
