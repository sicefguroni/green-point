variable "name" {
  description = "Name prefix for all VPC resources"
  type        = string
}

variable "cidr_block" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$", var.cidr_block))
    error_message = "CIDR block must be valid IPv4 CIDR notation."
  }
}

variable "availability_zones" {
  description = "List of availability zones to create subnets in"
  type        = list(string)
}

variable "enable_dns_hostnames" {
  description = "Enable DNS hostnames in the VPC"
  type        = bool
  default     = true
}

variable "nat_gateway_count" {
  description = "Number of NAT gateways to create (1 = single-AZ, 2 = multi-AZ)"
  type        = number
  default     = 1

  validation {
    condition     = contains([0, 1, 2], var.nat_gateway_count)
    error_message = "nat_gateway_count must be 0, 1, or 2."
  }
}

variable "tags" {
  description = "Additional tags applied to all resources"
  type        = map(string)
  default     = {}
}
