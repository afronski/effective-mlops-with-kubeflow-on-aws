#!/usr/bin/env node

import * as cdk from "aws-cdk-lib";

import { InfrastructureSharedStack  } from "../lib/infrastructure-shared";
import { InfrastructureSharedGlobalStack } from "../lib/infrastructure-shared-global";
import { WorkingEnvironment } from "../lib/working-environment";
import { InfrastructureSharedEKSClusterStack } from "../lib/infrastructure-shared-eks-cluster";
import { InfrastructureSharedKubeflowDepsStack } from "../lib/infrastructure-shared-kubeflow-deps";

const account = process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT || null;
const region = process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || null;
const userName = process.env.AWS_USERNAME || null;
const rootDomain = process.env.ROOT_DOMAIN || null;

if (!account) {
  throw new Error("Environment variable `AWS_ACCOUNT_ID` or `CDK_DEFAULT_ACCOUNT` is required.");
}

if (!region) {
  throw new Error("Environment variable `AWS_REGION` or `CDK_DEFAULT_REGION` is required.");
}

if (!userName) {
  throw new Error("Environment variable `AWS_USERNAME` is required.");
}

if (!rootDomain) {
  throw new Error("Environment variable `ROOT_DOMAIN` is required.");
}

const SHARED_ENVIRONMENT_SETTINGS = {
  env: { account, region }
};

const app = new cdk.App();

const common = new InfrastructureSharedStack(
  app, 
  "KubeflowOnAWS-Shared-Infrastructure", 
  { 
    ...SHARED_ENVIRONMENT_SETTINGS,
    
    rootDomain
  }
);

const global = new InfrastructureSharedGlobalStack(
  app,
  "KubeflowOnAWS-Shared-Global-Infrastructure",
  {
    env: {
      account,
      region: "us-east-1"
    },
    
    hostedZoneId: common.hostedZone.hostedZoneId,
    rootDomain
  }
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

new InfrastructureSharedKubeflowDepsStack(
  app, 
  "KubeflowOnAWS-Shared-Kubeflow-Dependencies", 
  {
    ...SHARED_ENVIRONMENT_SETTINGS,
    
    vpc: common.vpc,
    hostedZone: common.hostedZone,
    globalCertificate: global.globalCertificate,
    rootDomain
  }
);
