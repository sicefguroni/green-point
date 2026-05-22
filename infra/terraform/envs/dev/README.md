# GreenPoint Timeline Swarm — Dev Environment

This directory contains the Terraform composition for the **dev** environment of the Timeline Swarm backend service.

## Migration from Flat Config

This module replaces the previous flat Terraform configuration at `infra/terraform/`. All resource addresses changed — **do not skip this migration**.

### If you have existing resources in AWS (state file exists)

```bash
cd infra/terraform/envs/dev

# 1. Initialize with backend (if you uncommented it in versions.tf)
terraform init

# 2. Apply moved blocks (updates state addresses, no real changes)
terraform plan    # → should show 0 to create, 0 to destroy
terraform apply   # → only updates state, no resource changes

# 3. (Optional) Remove moved blocks once confirmed
rm moved.tf
terraform plan    # → should still show 0 changes
```

### If this is a new deployment (no existing state)

```bash
cd infra/terraform/envs/dev
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

## Deployment Steps

1. **Bootstrap state backend** (S3 + DynamoDB):
   ```bash
   cd infra/terraform/bootstrap
   terraform apply
   ```

2. **Configure backend** in `versions.tf` — uncomment the `backend "s3"` block and update the bucket name.

3. **Populate secrets** (Terraform creates containers, values set via AWS CLI):
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id greenpoint/timeline-swarm/openai-key \
     --secret-string "sk-..."
   aws secretsmanager put-secret-value \
     --secret-id greenpoint/timeline-swarm/database-url \
     --secret-string "postgresql://..."
   ```

4. **Build and push Docker image**:
   ```bash
   aws ecr get-login-password --region ap-southeast-1 | \
     docker login --username AWS --password-stdin <account>.dkr.ecr.ap-southeast-1.amazonaws.com
   cd ../../../python-services/timeline_swarm
   docker build -t greenpoint-timeline-swarm .
   docker tag greenpoint-timeline-swarm:latest <ecr-repo-uri>:latest
   docker push <ecr-repo-uri>:latest
   ```

5. **Deploy infrastructure**:
   ```bash
   cd infra/terraform/envs/dev
   terraform plan -out=tfplan
   terraform apply tfplan
   ```

6. **Configure Vercel** — set `TIMELINE_SWARM_SERVICE_URL` to the ALB DNS name from outputs.

## Module Structure

```
infra/terraform/
├── bootstrap/           # S3 + DynamoDB state backend (one-time setup)
├── modules/
│   ├── vpc/             # VPC, subnets, IGW, NAT, route tables
│   ├── ecr/             # ECR repository with lifecycle policy
│   ├── secrets/         # Secrets Manager (supports create or reference)
│   ├── iam/             # Task + execution roles with policies
│   └── ecs-timeline/    # ECS cluster, Fargate task, ALB, CloudWatch
└── envs/
    └── dev/             # <-- You are here
```
