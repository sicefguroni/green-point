variable "secrets" {
  description = <<-EOT
    Map of secret names to their configurations.
    Each entry can specify:
      - description: Human-readable description
      - existing_arn: ARN of an already-created secret (optional - if omitted, creates a new secret container)
      - tags: Additional tags (optional)
  EOT
  type = map(object({
    description  = optional(string, "")
    existing_arn = optional(string, "")
    tags         = optional(map(string), {})
  }))
}

variable "tags" {
  description = "Default tags applied to all created secrets"
  type        = map(string)
  default     = {}
}
