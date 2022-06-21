import { StackProps } from "aws-cdk-lib";

export interface InfrastructureSharedProps extends StackProps {
  rootDomain: string;
}
