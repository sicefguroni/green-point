# This module supports both:
# 1. Creating new secret containers (when existing_arn is not provided)
# 2. Referencing pre-existing secrets (when existing_arn is provided)
#
# Secret values are NEVER managed by Terraform — use `aws secretsmanager put-secret-value`
# to populate them after creation. The `aws_secretsmanager_secret` resource only manages
# the secret container (name, description, tags).

locals {
  secret_names = keys(var.secrets)
}

# ──────────── Data sources for pre-existing secrets ────────────
data "aws_secretsmanager_secret" "existing" {
  for_each = { for k, v in var.secrets : k => v if v.existing_arn != "" }
  arn      = each.value.existing_arn
}

# ──────────── New secret containers ────────────
resource "aws_secretsmanager_secret" "new" {
  for_each = { for k, v in var.secrets : k => v if v.existing_arn == "" }

  name        = each.key
  description = each.value.description

  tags = merge(var.tags, each.value.tags, { Name = each.key })
}

# ──────────── Unified output locals ────────────
locals {
  # try() safely selects whichever resource exists (data source or managed).
  # It short-circuits on index-out-of-range from for_each lookups.
  secret_ids = {
    for name in local.secret_names :
    name => try(
      data.aws_secretsmanager_secret.existing[name].id,
      aws_secretsmanager_secret.new[name].id,
    )
  }
  secret_arns = {
    for name in local.secret_names :
    name => try(
      data.aws_secretsmanager_secret.existing[name].arn,
      aws_secretsmanager_secret.new[name].arn,
    )
  }
}
