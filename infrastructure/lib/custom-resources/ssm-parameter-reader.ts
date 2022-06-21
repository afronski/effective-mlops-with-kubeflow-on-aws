import { Construct } from "constructs";

import { AwsCustomResource } from "aws-cdk-lib/custom-resources";

import * as statement from "cdk-iam-floyd";

interface SSMParameterReaderProps {
  parameterName: string;
  region: string;
}

export class SSMParameterReader extends AwsCustomResource {
  constructor(scope: Construct, name: string, props: SSMParameterReaderProps) {
    const { parameterName, region } = props;

    const call = {
      service: "SSM",
      action: "getParameter",
      parameters: {
        Name: parameterName
      },
      region,

      // Update physical id to always fetch the latest version.
      physicalResourceId: {
        id: Date.now().toString()
      }
    };

    super(
      scope,
      name,
      {
        onUpdate: call,
        policy: {
          statements: [ new statement.Ssm().onAllResources().allow().toGetParameter() ]
        }
      }
    );
  }

  public getParameterValue(): string {
    return this.getResponseField("Parameter.Value").toString();
  }
}
