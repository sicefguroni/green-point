variable "name" {
  description = "Name of the ECR repository"
  type        = string
}

variable "max_image_count" {
  description = "Maximum number of images to retain (0 = unlimited)"
  type        = number
  default     = 5
}

variable "scan_on_push" {
  description = "Enable image scanning on push"
  type        = bool
  default     = true
}

variable "force_delete" {
  description = "Allow force deletion of the repository (even if it contains images)"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
