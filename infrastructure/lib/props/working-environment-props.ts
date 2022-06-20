import { StackProps } from "aws-cdk-lib";
import { SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import { Bucket } from "aws-cdk-lib/aws-s3";

export interface WorkingEnvironmentProps extends StackProps {
  repositoryCloneUrlHttp: string;
  vpc: Vpc;
  openedSecurityGroup: SecurityGroup;
  dataBucket: Bucket;
  userName: string;
}
