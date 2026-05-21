import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export class TimelineSwarmStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ──────────── ECR Repository ────────────
    const repository = new ecr.Repository(this, "TimelineSwarmRepo", {
      repositoryName: "greenpoint-timeline-swarm",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
      imageScanOnPush: true,
      lifecycleRules: [
        { maxImageCount: 5, rulePriority: 1 },
      ],
    });

    // ──────────── VPC ────────────
    const vpc = new ec2.Vpc(this, "TimelineSwarmVpc", {
      maxAzs: 2,
      natGateways: 1,
      restrictDefaultSecurityGroup: true,
    });

    // ──────────── ECS Cluster ────────────
    const cluster = new ecs.Cluster(this, "TimelineSwarmCluster", {
      vpc,
      clusterName: "greenpoint-timeline-swarm",
      containerInsights: true,
    });

    // ──────────── CloudWatch Log Group ────────────
    const logGroup = new logs.LogGroup(this, "TimelineSwarmLogs", {
      logGroupName: "/ecs/greenpoint/timeline-swarm",
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ──────────── Secrets ────────────
    // Create placeholder secrets. Before deploying, store actual values:
    //   aws secretsmanager put-secret-value \
    //     --secret-id greenpoint/timeline-swarm/openai-key \
    //     --secret-string "sk-..."
    //
    //   aws secretsmanager put-secret-value \
    //     --secret-id greenpoint/timeline-swarm/database-url \
    //     --secret-string "postgresql://..."
    const openAiKeySecret = new secretsmanager.Secret(this, "OpenAiApiKey", {
      secretName: "greenpoint/timeline-swarm/openai-key",
      description: "OpenAI API key for the GreenPoint Timeline Swarm service",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ apiKey: "placeholder" }),
        generateStringKey: "placeholder",
        excludePunctuation: true,
      },
    });

    const databaseUrlSecret = new secretsmanager.Secret(this, "DatabaseUrl", {
      secretName: "greenpoint/timeline-swarm/database-url",
      description: "Postgres connection string for LangGraph checkpoint store (Supabase direct connection)",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ connectionString: "placeholder" }),
        generateStringKey: "placeholder",
        excludePunctuation: true,
      },
    });

    const openAiModelSecret = new secretsmanager.Secret(this, "OpenAiModel", {
      secretName: "greenpoint/timeline-swarm/openai-model",
      description: "OpenAI model name for the Timeline Swarm LLM calls (e.g. gpt-5.4-mini)",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ model: "gpt-5.4-mini" }),
        generateStringKey: "placeholder",
        excludePunctuation: true,
      },
    });

    const langGraphStrictMsgpackSecret = new secretsmanager.Secret(
      this,
      "LangGraphStrictMsgpack",
      {
        secretName: "greenpoint/timeline-swarm/langgraph-strict-msgpack",
        description: "Enables strict MessagePack serialization for LangGraph checkpoints",
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        generateSecretString: {
          secretStringTemplate: JSON.stringify({ enabled: "true" }),
          generateStringKey: "placeholder",
          excludePunctuation: true,
        },
      },
    );

    // ──────────── Task Role ────────────
    const taskRole = new iam.Role(this, "TimelineSwarmTaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      description: "Task role for GreenPoint Timeline Swarm ECS tasks",
    });
    // Allow reading the secrets
    openAiKeySecret.grantRead(taskRole);
    databaseUrlSecret.grantRead(taskRole);
    openAiModelSecret.grantRead(taskRole);
    langGraphStrictMsgpackSecret.grantRead(taskRole);
    // Allow ECR pull
    repository.grantPull(taskRole);

    // ──────────── Fargate Service with ALB ────────────
    const fargateService =
      new ecsPatterns.ApplicationLoadBalancedFargateService(
        this,
        "TimelineSwarmService",
        {
          cluster,
          serviceName: "greenpoint-timeline-swarm",
          taskDefinition: new ecs.FargateTaskDefinition(
            this,
            "TimelineSwarmTaskDef",
            {
              family: "greenpoint-timeline-swarm",
              cpu: 512,
              memoryLimitMiB: 1024,
              taskRole,
            },
          ),
          desiredCount: 1,
          minHealthyPercent: 100,
          maxHealthyPercent: 200,
          assignPublicIp: true,
          // For production, use an ACM certificate and switch to HTTPS:
          //   listenerPort: 443,
          //   protocol: ecs.Protocol.HTTPS,
          //   certificate: acm.Certificate.fromCertificateArn(...),
          listenerPort: 80,
          targetProtocol: elbv2.ApplicationProtocol.HTTP,
          protocol: elbv2.ApplicationProtocol.HTTP,
          capacityProviderStrategies: [
            {
              capacityProvider: "FARGATE_SPOT",
              weight: 1,
              base: 0,
            },
          ],
          circuitBreaker: {
            enable: true,
            rollback: true,
          },
        },
      );

    // Configure ALB target group health check
    fargateService.targetGroup.configureHealthCheck({
      path: "/health",
      interval: cdk.Duration.seconds(15),
      timeout: cdk.Duration.seconds(5),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
    });

    // Add the container to the task definition
    fargateService.taskDefinition.addContainer("TimelineSwarmContainer", {
      image: ecs.ContainerImage.fromEcrRepository(repository, "latest"),
      containerName: "timeline-swarm",
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "timeline-swarm",
        logGroup,
      }),
      environment: {
        CORS_ORIGINS: [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          // Add your Vercel production domain here:
          // "https://greenpoint.vercel.app",
        ].join(","),
      },
      secrets: {
        OPENAI_API_KEY: ecs.Secret.fromSecretsManager(openAiKeySecret, "apiKey"),
        TIMELINE_SWARM_DATABASE_URL: ecs.Secret.fromSecretsManager(
          databaseUrlSecret,
          "connectionString",
        ),
        OPENAI_TIMELINE_MODEL: ecs.Secret.fromSecretsManager(
          openAiModelSecret,
          "model",
        ),
        LANGGRAPH_STRICT_MSGPACK: ecs.Secret.fromSecretsManager(
          langGraphStrictMsgpackSecret,
          "enabled",
        ),
      },
      portMappings: [
        {
          containerPort: 8001,
          protocol: ecs.Protocol.TCP,
        },
      ],
      healthCheck: {
        command: [
          "CMD-SHELL",
          "curl -sf http://localhost:8001/health || exit 1",
        ],
        interval: cdk.Duration.seconds(15),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(30),
      },
      cpu: 512,
      memoryLimitMiB: 1024,
    });

    // Allow outbound HTTPS from the ECS tasks
    fargateService.service.connections.allowToAnyIpv4(
      ec2.Port.tcp(443),
      "Allow outbound HTTPS to OpenAI API",
    );

    // ──────────── Outputs ────────────
    new cdk.CfnOutput(this, "EcrRepositoryUri", {
      value: repository.repositoryUri,
      description: "Push your Docker image here",
    });

    new cdk.CfnOutput(this, "LoadBalancerDns", {
      value: fargateService.loadBalancer.loadBalancerDnsName,
      description: "Set TIMELINE_SWARM_SERVICE_URL in Vercel to http://<this>/",
    });

    new cdk.CfnOutput(this, "BuildPushCommand", {
      value:
        `aws ecr get-login-password --region ${this.region} | ` +
        `docker login --username AWS --password-stdin ${repository.repositoryUri}` +
        `\n` +
        `docker build -t greenpoint-timeline-swarm ../../python-services/timeline_swarm` +
        `\n` +
        `docker tag greenpoint-timeline-swarm:latest ${repository.repositoryUri}:latest` +
        `\n` +
        `docker push ${repository.repositoryUri}:latest`,
      description: "Commands to build and push the Docker image",
    });
  }
}
