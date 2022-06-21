import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";

import { Certificate, CertificateValidation } from "aws-cdk-lib/aws-certificatemanager";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import { StringParameter } from "aws-cdk-lib/aws-ssm";

import { SSMParameterReader } from "./custom-resources/ssm-parameter-reader";
import { CustomSSMParameter } from "./custom-resources/custom-ssm-parameter";

import { CROSS_REGION_PARAMETERS } from "./parameters/cross-region-parameters";

interface InfrastructureSharedGlobalProps extends StackProps {
  hostedZoneIdParameter: CustomSSMParameter;
  rootDomain: string;
}

export class InfrastructureSharedGlobalStack extends Stack {
  constructor (scope: Construct, id: string, props: InfrastructureSharedGlobalProps) {
    super(scope, id, props);

    // Public certificate in AWS ACM for `us-east-1`, as it's needed for Cognito.
    // We take the HostedZoneId from SSM parameter in a different region.

    const reader = new SSMParameterReader(this, "PlatformHostedZoneIdSSMParameterReader", {
      parameterName: props.hostedZoneIdParameter.name,
      region: props.hostedZoneIdParameter.region
    });

    const hostedZoneId = reader.getParameterValue();
    const hostedZone = HostedZone.fromHostedZoneId(this, "PlatformHostedZone", hostedZoneId);

    const globalCertificate = new Certificate(this, "CognitoGlobalCertificate", {
      domainName: `*.platform.${props.rootDomain}`,
      validation: CertificateValidation.fromDns(hostedZone),
    });

    // Exporting SSM Parameter name in `us-east-1`.

    new StringParameter(this, "HostedZoneIdForKubeflowPlatformSubdomain", {
      parameterName: CROSS_REGION_PARAMETERS.GLOBAL_CERTIFICATE_ARN,
      stringValue: globalCertificate.certificateArn
    });
  }
}
