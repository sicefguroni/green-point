output "secret_ids" {
  description = "Map of secret names to their IDs (ARNs)"
  value       = local.secret_ids
}

output "secret_arns" {
  description = "Map of secret names to their ARNs"
  value       = local.secret_arns
}

output "secret_names" {
  description = "List of all secret names"
  value       = local.secret_names
}
