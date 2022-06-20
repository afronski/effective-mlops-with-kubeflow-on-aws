#!/usr/bin/env node

import * as cdk from "aws-cdk-lib";

import { InfrastructureSharedStack  } from "../lib/infrastructure-shared";
import { InfrastructureSharedEKSClusterStack } from "../lib/infrastructure-shared-eks-cluster";
import { WorkingEnvironment } from "../lib/working-environment";

const account = process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT || null;
const region = process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || null;
const userName = process.env.AWS_USERNAME || null;

if (!account) {
  throw new Error("Environment variable `AWS_ACCOUNT_ID` or `CDK_DEFAULT_ACCOUNT` is required.");
}

if (!region) {
  throw new Error("Environment variable `AWS_REGION` or `CDK_DEFAULT_REGION` is required.");
}

if (!userName) {
  throw new Error("Environment variable `AWS_USERNAME` is required.");
}

const SHARED_ENVIRONMENT_SETTINGS = {
  env: { account, region }
};

const app = new cdk.App();

const common = new InfrastructureSharedStack(
  app, 
  "KubeflowOnAWS-Shared-Infrastructure", 
  SHARED_ENVIRONMENT_SETTINGS
);

new WorkingEnvironment(
  app, 
  "KubeflowOnAWS-WorkingEnvironment", 
  {
    ...SHARED_ENVIRONMENT_SETTINGS,

    repositoryCloneUrlHttp: common.repositoryCloneUrlHttp,
    dataBucket: common.dataBucket,

    vpc: common.vpc,
    openedSecurityGroup: common.openedSecurityGroup,
    
    userName
  }
);

new InfrastructureSharedEKSClusterStack(
  app, 
  "KubeflowOnAWS-Shared-EKS", 
  {
    ...SHARED_ENVIRONMENT_SETTINGS,
    
    vpc: common.vpc,
    userName
  }
);
