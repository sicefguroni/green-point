locals {
  tags = merge(var.tags, { Name = "${var.name}-ecr" })
}

resource "aws_ecr_repository" "this" {
  name         = var.name
  force_delete = var.force_delete

  image_scanning_configuration {
    scan_on_push = var.scan_on_push
  }

  image_tag_mutability = "MUTABLE"

  tags = local.tags
}

resource "aws_ecr_lifecycle_policy" "this" {
  count      = var.max_image_count > 0 ? 1 : 0
  repository = aws_ecr_repository.this.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep only the ${var.max_image_count} most recent images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = var.max_image_count
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
