variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-southeast-1"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["ap-southeast-1a", "ap-southeast-1b"]
}

variable "ecs_cpu" {
  description = "CPU units for the Fargate task"
  type        = number
  default     = 512

  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.ecs_cpu)
    error_message = "ecs_cpu must be one of 256, 512, 1024, 2048, or 4096."
  }
}

variable "ecs_memory" {
  description = "Memory (MiB) for the Fargate task"
  type        = number
  default     = 1024

  validation {
    condition     = contains([512, 1024, 2048, 3072, 4096, 5120, 6144, 7168, 8192], var.ecs_memory)
    error_message = "ecs_memory must be a valid Fargate memory value."
  }
}

variable "desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 1
}

variable "container_image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "cors_origins" {
  description = "List of allowed CORS origins"
  type        = list(string)
  default = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]
}
