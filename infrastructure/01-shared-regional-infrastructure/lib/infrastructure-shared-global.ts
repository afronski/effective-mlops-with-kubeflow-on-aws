import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";

import { Certificate, CertificateValidation } from "aws-cdk-lib/aws-certificatemanager";
import { HostedZone } from "aws-cdk-lib/aws-route53";

import { InfrastructureSharedGlobalProps } from "./props/infrastructure-shared-global-props";

export class InfrastructureSharedGlobalStack extends Stack {
  public readonly globalCertificate: Certificate;
  
  constructor (scope: Construct, id: string, props: InfrastructureSharedGlobalProps) {
    super(scope, id, props);

    // Public certificate in AWS ACM for `us-east-1`, as it's needed for Cognito.

    const hostedZone = HostedZone.fromHostedZoneId(this, "PlatformHostedZone", props.hostedZoneId);

    this.globalCertificate = new Certificate(this, "CognitoGlobalCertificate", {
      domainName: `*.platform.${props.rootDomain}`,
      validation: CertificateValidation.fromDns(hostedZone),
    });
  }
}
