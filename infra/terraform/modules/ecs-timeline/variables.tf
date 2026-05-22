variable "service_name" {
  description = "Name prefix for all ECS resources"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC to deploy into"
  type        = string
}

variable "public_subnet_ids" {
  description = "IDs of public subnets for the ALB"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "IDs of private subnets for ECS tasks"
  type        = list(string)
}

variable "container_image" {
  description = "Container image URL (from ECR)"
  type        = string
}

variable "container_port" {
  description = "Port the container listens on"
  type        = number
  default     = 8001
}

variable "container_cpu" {
  description = "CPU units for the Fargate task"
  type        = number
  default     = 512
}

variable "container_memory" {
  description = "Memory (MiB) for the Fargate task"
  type        = number
  default     = 1024
}

variable "desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 1
}

variable "task_role_arn" {
  description = "ARN of the IAM task role"
  type        = string
}

variable "execution_role_arn" {
  description = "ARN of the IAM execution role"
  type        = string
}

variable "environment_variables" {
  description = "Map of environment variables for the container"
  type        = map(string)
  default     = {}
}

variable "secret_environment_variables" {
  description = "Map of secret names to Secrets Manager ARNs"
  type        = map(string)
  default     = {}
}

variable "health_check_path" {
  description = "Path for the ALB target group health check"
  type        = string
  default     = "/health"
}

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 30
}

variable "use_fargate_spot" {
  description = "Use FARGATE_SPOT capacity provider"
  type        = bool
  default     = true
}

variable "alb_listener_port" {
  description = "Port for the ALB listener"
  type        = number
  default     = 80
}

variable "alb_listener_protocol" {
  description = "Protocol for the ALB listener (HTTP or HTTPS)"
  type        = string
  default     = "HTTP"
}

variable "tags" {
  description = "Default tags applied to all resources"
  type        = map(string)
  default     = {}
}
