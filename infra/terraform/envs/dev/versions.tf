terraform {
  required_version = ">= 1.5.0"

  # ─── Remote State Backend ─────────────────────────────────────────────────
  # Bootstrap complete at bucket=greenpoint-tf-state-646385694637
  #
  backend "s3" {
    bucket       = "greenpoint-tf-state-646385694637"
    key          = "greenpoint/timeline-swarm/dev/terraform.tfstate"
    region       = "ap-southeast-1"
    encrypt      = true
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
