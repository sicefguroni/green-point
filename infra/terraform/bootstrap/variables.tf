variable "state_bucket_name" {
  description = "Name of the S3 bucket for Terraform remote state"
  type        = string

  validation {
    condition     = length(var.state_bucket_name) >= 3 && length(var.state_bucket_name) <= 63
    error_message = "state_bucket_name must be 3-63 characters long."
  }
}

variable "dynamodb_lock_table_name" {
  description = "Name of the DynamoDB table for Terraform state locking"
  type        = string
  default     = "terraform-state-lock"

  validation {
    condition     = length(var.dynamodb_lock_table_name) >= 3 && length(var.dynamodb_lock_table_name) <= 255
    error_message = "dynamodb_lock_table_name must be 3-255 characters long."
  }
}
