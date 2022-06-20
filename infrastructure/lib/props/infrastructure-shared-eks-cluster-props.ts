import { StackProps } from "aws-cdk-lib";
import { Vpc } from "aws-cdk-lib/aws-ec2";

export interface InfrastructureSharedEKSClusterProps extends StackProps {
  userName: string;
  vpc: Vpc;
}
