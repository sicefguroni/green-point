# ──────────── AWS ────────────
aws_region = "ap-southeast-1"

# ──────────── Networking ────────────
vpc_cidr           = "10.0.0.0/16"
availability_zones = ["ap-southeast-1a", "ap-southeast-1b"]

# ──────────── ECS ────────────
ecs_cpu       = 512
ecs_memory    = 1024
desired_count = 1

# ──────────── Container ────────────
container_image_tag = "deploy-20260522-062148"

# ──────────── CORS ────────────
cors_origins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  # Add production domain when deployed:
  # "https://greenpoint.vercel.app",
]
