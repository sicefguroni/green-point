variable "service_name" {
  description = "Name prefix for all IAM resources"
  type        = string
}

variable "secret_arns" {
  description = "List of Secrets Manager ARNs that the task role can read"
  type        = list(string)
  default     = []
}

variable "ecr_repository_arns" {
  description = "List of ECR repository ARNs that the execution role can pull from"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Default tags"
  type        = map(string)
  default     = {}
}
