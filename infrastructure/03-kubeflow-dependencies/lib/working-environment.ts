import { Fn, RemovalPolicy, Stack, Tags } from "aws-cdk-lib";
import { Construct } from "constructs";

import { CfnEnvironmentEC2 } from "aws-cdk-lib/aws-cloud9";
import { InstanceClass, InstanceSize, InstanceType } from "aws-cdk-lib/aws-ec2";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";
import { CfnAssociation, CfnDocument } from "aws-cdk-lib/aws-ssm";

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

import { WorkingEnvironmentProps } from "./props/working-environment-props";

export class WorkingEnvironment extends Stack {
  constructor (scope: Construct, id: string, props: WorkingEnvironmentProps) {
    super(scope, id, props);

    const { account } = Stack.of(this);

    // Now, fasten your seatbelt - because the crazy shit is in front of us!
    //
    // In order to automatically extend disk size and pre-install stuff on AWS Cloud9 IDE, you need
    // to do a back-flip on a onwheel riding on a line 100 m above the earth.
    //
    // This requires that default IAM role applied to the AWS Cloud9 environments had administrator
    // permissions and trust relationship with SSM.
    //
    // In the meantime you create SSM Automation Document and association via EC2 tags.
    // I think you get the idea what this document does, right? ;)
    //
    // If the AWS Cloud9 has special tag applied SSM document kicks in and completes bootstrapping.

    const outputBucket = new Bucket(this, "Cloud9BootstrappingViaSSMLogsBucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL
    });

    outputBucket.applyRemovalPolicy(RemovalPolicy.DESTROY);

    const content = fs.readFileSync(path.join(__dirname, "assets/aws-cloud9-bootstrap.yml")).toString();

    const document = new CfnDocument(this, "Cloud9IDEAutomationScript", {
      documentType: "Command",
      content: yaml.load(content)
    });

    new CfnAssociation(this, "Cloud9IDEAssociation", {
      name: Fn.ref(document.logicalId),
      outputLocation: {
        s3Location: {
          outputS3BucketName: outputBucket.bucketName,
          outputS3KeyPrefix: "bootstrapping-logs"
        }
      },
      targets: [ { key: "tag:BootstrapViaSSM", values: [ "true" ] } ]
    });
    
    const ide = new CfnEnvironmentEC2(this, "Cloud9MainIDE", {
      name: `ide-for-${props.userName}`,
      description: `IDE for ${props.userName}.`,

      instanceType: InstanceType.of(InstanceClass.M5, InstanceSize.LARGE).toString(),

      ownerArn: `arn:aws:iam::${account}:user/${props.userName}`,

      connectionType: "CONNECT_SSM",
      automaticStopTimeMinutes: 60,

      repositories: [
        {
          pathComponent: "/repos/effective-mlops-with-kubeflow-on-aws",
          repositoryUrl: props.repositoryCloneUrlHttp
        }
      ],

      imageId: "resolve:ssm:/aws/service/cloud9/amis/amazonlinux-2-x86_64",
      
      subnetId: props.vpc.privateSubnets[0].subnetId
    });
    
    // Kick-off SSM bootstrapping.
    Tags.of(ide).add("BootstrapViaSSM", "true");
  }
}
