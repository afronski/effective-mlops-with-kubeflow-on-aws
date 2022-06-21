import { StackProps } from "aws-cdk-lib";

export interface InfrastructureSharedGlobalProps extends StackProps {
  hostedZoneId: string;
  rootDomain: string;
}
