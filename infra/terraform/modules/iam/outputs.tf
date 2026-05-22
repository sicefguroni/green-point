output "task_role_arn" {
  description = "ARN of the ECS task role"
  value       = aws_iam_role.task.arn
}

output "task_role_name" {
  description = "Name of the ECS task role"
  value       = aws_iam_role.task.name
}

output "execution_role_arn" {
  description = "ARN of the ECS execution role"
  value       = aws_iam_role.execution.arn
}

output "execution_role_name" {
  description = "Name of the ECS execution role"
  value       = aws_iam_role.execution.name
}
