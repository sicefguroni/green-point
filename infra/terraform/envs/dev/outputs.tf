output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = module.ecr.repository_url
}

output "lb_dns_name" {
  description = "DNS name of the ALB. Set TIMELINE_SWARM_SERVICE_URL=http://<this>/ in Vercel."
  value       = module.ecs.lb_dns_name
}

output "lb_zone_id" {
  description = "Route53 zone ID of the ALB (for custom domain)"
  value       = module.ecs.lb_zone_id
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = module.ecs.cluster_name
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = module.ecs.service_name
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group name"
  value       = module.ecs.cloudwatch_log_group
}

output "secret_ids" {
  description = "Map of secret names to IDs. Use put-secret-value to populate."
  value       = module.secrets.secret_ids
}

output "secret_arns" {
  description = "Map of secret names to ARNs"
  value       = module.secrets.secret_arns
}

output "build_and_push_command" {
  description = "Commands to build and push the Docker image to ECR"
  value       = <<-EOT
    # Log in to ECR
    aws ecr get-login-password --region ${var.aws_region} | \
      docker login --username AWS --password-stdin ${module.ecr.repository_url}

    # Build the Docker image
    docker build -t greenpoint-timeline-swarm python-services/timeline_swarm

    # Tag and push
    docker tag greenpoint-timeline-swarm:latest ${module.ecr.repository_url}:${var.container_image_tag}
    docker push ${module.ecr.repository_url}:${var.container_image_tag}
  EOT
}

output "set_secret_commands" {
  description = "Commands to populate the placeholder secrets with real values"
  value       = <<-EOT
    aws secretsmanager put-secret-value \
      --secret-id ${module.secrets.secret_ids["greenpoint/timeline-swarm/openai-key"]} \
      --secret-string '{"apiKey":"sk-your-actual-key-here"}'

    aws secretsmanager put-secret-value \
      --secret-id ${module.secrets.secret_ids["greenpoint/timeline-swarm/database-url"]} \
      --secret-string '{"connectionString":"postgresql://user:pass@host:5432/db"}'

    aws secretsmanager put-secret-value \
      --secret-id ${module.secrets.secret_ids["greenpoint/timeline-swarm/openai-model"]} \
      --secret-string '{"model":"gpt-5.4-mini"}'

    aws secretsmanager put-secret-value \
      --secret-id ${module.secrets.secret_ids["greenpoint/timeline-swarm/langgraph-strict-msgpack"]} \
      --secret-string '{"enabled":"true"}'
  EOT
}
