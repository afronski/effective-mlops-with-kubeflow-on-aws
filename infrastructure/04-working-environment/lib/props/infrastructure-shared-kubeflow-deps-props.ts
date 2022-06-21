import { StackProps } from "aws-cdk-lib";

import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { Vpc } from "aws-cdk-lib/aws-ec2";
import { HostedZone } from "aws-cdk-lib/aws-route53";

export interface InfrastructureSharedKubeflowDepsProps extends StackProps {
  vpc: Vpc;
  globalCertificate: Certificate;
  hostedZone: HostedZone;
  rootDomain: string;
}
