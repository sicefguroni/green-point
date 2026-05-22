locals {
  az_count = length(var.availability_zones)
  tags     = merge(var.tags, { Name = var.name })
}

# ──────────── VPC ────────────
resource "aws_vpc" "this" {
  cidr_block           = var.cidr_block
  enable_dns_hostnames = var.enable_dns_hostnames
  enable_dns_support   = true

  tags = merge(local.tags, { Name = "${var.name}-vpc" })
}

# ──────────── Internet Gateway ────────────
resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = merge(local.tags, { Name = "${var.name}-igw" })
}

# ──────────── Public Subnets ────────────
resource "aws_subnet" "public" {
  count = local.az_count

  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(var.cidr_block, 8, count.index)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.tags, { Name = "${var.name}-public-${count.index + 1}", Tier = "public" })
}

# ──────────── Private Subnets ────────────
resource "aws_subnet" "private" {
  count = local.az_count

  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.cidr_block, 8, count.index + local.az_count)
  availability_zone = var.availability_zones[count.index]

  tags = merge(local.tags, { Name = "${var.name}-private-${count.index + 1}", Tier = "private" })
}

# ──────────── Public Route Table ────────────
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = merge(local.tags, { Name = "${var.name}-public", Tier = "public" })
}

resource "aws_route_table_association" "public" {
  count = local.az_count

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ──────────── NAT Gateway(s) ────────────
resource "aws_eip" "nat" {
  count  = var.nat_gateway_count
  domain = "vpc"
  tags   = merge(local.tags, { Name = "${var.name}-nat-${count.index + 1}" })
}

resource "aws_nat_gateway" "this" {
  count = var.nat_gateway_count

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(local.tags, { Name = "${var.name}-nat-${count.index + 1}" })

  depends_on = [aws_internet_gateway.this]
}

# ──────────── Private Route Table ────────────
resource "aws_route_table" "private" {
  count = max(var.nat_gateway_count, 1)

  vpc_id = aws_vpc.this.id

  dynamic "route" {
    for_each = var.nat_gateway_count > 0 ? [1] : []
    content {
      cidr_block     = "0.0.0.0/0"
      nat_gateway_id = aws_nat_gateway.this[0].id
    }
  }

  tags = merge(local.tags, { Name = "${var.name}-private", Tier = "private" })
}

resource "aws_route_table_association" "private" {
  count = local.az_count

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[0].id
}

# ──────────── Restrict default security group ────────────
resource "aws_default_security_group" "this" {
  vpc_id = aws_vpc.this.id

  ingress = []
  egress  = []

  tags = merge(local.tags, { Name = "${var.name}-default-sg" })
}
