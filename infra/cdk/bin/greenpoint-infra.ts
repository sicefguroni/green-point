#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { TimelineSwarmStack } from "../lib/timeline-swarm-stack";

const app = new cdk.App();
new TimelineSwarmStack(app, "GreenPointTimelineSwarm", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "ap-southeast-1",
  },
  description: "GreenPoint Timeline Swarm — FastAPI + LangGraph on ECS Fargate",
});
