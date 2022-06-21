import { CfnOutput, Fn, RemovalPolicy, Stack, Tags } from "aws-cdk-lib";
import { Construct } from "constructs";

import { Repository } from "aws-cdk-lib/aws-codecommit";
import { BastionHostLinux } from "aws-cdk-lib/aws-ec2";
import { GatewayVpcEndpointAwsService, Peer, Port, SecurityGroup, SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";

import { InfrastructureSharedProps } from "./props/infrastructure-shared-props";

export class InfrastructureSharedStack extends Stack {
  public readonly repositoryCloneUrlHttp: string;
  public readonly dataBucket: Bucket;
  public readonly vpc: Vpc;
  public readonly openedSecurityGroup: SecurityGroup;
  public readonly hostedZone: HostedZone;

  constructor (scope: Construct, id: string, props: InfrastructureSharedProps) {
    super(scope, id, props);

    // AWS CodeCommit Git repository shared across AWS Cloud9 instances.
    const repository = new Repository(this, "CodeRepository", {
      repositoryName: "effective-mlops-with-kubeflow-on-aws",
      description: "Source code for 'Effective MLOps with Kubeflow on AWS'" +
             " talk presented by Wojciech Gawroński (AWS Maniac)."
    });

    repository.applyRemovalPolicy(RemovalPolicy.DESTROY);

    new CfnOutput(this, "CodeRepositoryCloneUrlHTTP", {
      exportName: "CodeRepositoryCloneUrlHTTP",
      value: repository.repositoryCloneUrlHttp
    });

    this.repositoryCloneUrlHttp = repository.repositoryCloneUrlHttp;

    // Shared S3 Bucket for common data.
    this.dataBucket = new Bucket(this, "DataBucket", {
      bucketName: `effective-mlops-with-kubeflow-on-aws-data-${Stack.of(this).region}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL
    });

    this.dataBucket.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // Another shared element is AWS Networking - where we start with a VPC.
    this.vpc = new Vpc(this, "SharedVPC", {
      cidr: "10.0.0.0/16",
      maxAzs: 3,
      natGateways: 3
    });

    // `NATGateway` must wait for `VPCGatewayAttachment`.
    const vpcGateway = this.vpc.node.findChild("VPCGW");

    const nat1 = this.vpc.node.findChild("PublicSubnet1").node.findChild("NATGateway");
    const nat2 = this.vpc.node.findChild("PublicSubnet2").node.findChild("NATGateway");
    const nat3 = this.vpc.node.findChild("PublicSubnet3").node.findChild("NATGateway");

    nat1.node.addDependency(vpcGateway);
    nat2.node.addDependency(vpcGateway);
    nat3.node.addDependency(vpcGateway);

    // VPC Gateway Endpoint for Amazon S3.
    this.vpc.addGatewayEndpoint("VPCGatewayEndpointForS3InSharedVPC", {
      service: GatewayVpcEndpointAwsService.S3,
      subnets: [ { subnetType: SubnetType.PRIVATE_WITH_NAT } ]
    });

    // Now we need to add Security Groups.
    // SSH
    let securityGroupName = "shared-sg-ssh-opened";

    const sshSecurityGroup = new SecurityGroup(this, "SSH-SG", {
      securityGroupName,
      vpc: this.vpc,
      allowAllOutbound: true
    });

    sshSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(22));
    sshSecurityGroup.addIngressRule(Peer.anyIpv6(), Port.tcp(22));

    Tags.of(sshSecurityGroup).add("Name", securityGroupName);

    // HTTPS
    securityGroupName = "shared-sg-https-opened";

    const httpsSecurityGroup = new SecurityGroup(this, "HTTPS-SG", {
      securityGroupName,
      vpc: this.vpc,
      allowAllOutbound: true
    });

    httpsSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(443));
    httpsSecurityGroup.addIngressRule(Peer.anyIpv6(), Port.tcp(443));

    Tags.of(httpsSecurityGroup).add("Name", securityGroupName);

    // HTTP
    securityGroupName = "shared-sg-http-opened";

    const httpSecurityGroup = new SecurityGroup(this, "HTTP-SG", {
      securityGroupName,
      vpc: this.vpc,
      allowAllOutbound: true
    });

    httpSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80));
    httpSecurityGroup.addIngressRule(Peer.anyIpv6(), Port.tcp(80));

    Tags.of(httpsSecurityGroup).add("Name", securityGroupName);

    // Fully opened to all traffic.
    securityGroupName = "shared-sg-open-to-public";

    this.openedSecurityGroup = new SecurityGroup(this, "OPEN-SG", {
      securityGroupName,
      vpc: this.vpc,
      allowAllOutbound: true
    });

    this.openedSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.allTraffic());
    this.openedSecurityGroup.addIngressRule(Peer.anyIpv6(), Port.allTraffic());

    Tags.of(this.openedSecurityGroup).add("Name", securityGroupName);

    // Bastion host.
    const bastion = new BastionHostLinux(this, "SharedBastionHost", {
      subnetSelection: { subnetType: SubnetType.PUBLIC },
      securityGroup: sshSecurityGroup,
      vpc: this.vpc
    });

    new CfnOutput(this, "BastionPublicIP", { value: bastion.instancePublicIp });
    
    // Amazon Route 53 hosted zone for the that will be ingress front-end.
    
    this.hostedZone = new HostedZone(this, "HostedZoneForKubeflowPlatformSubdomain", {
      zoneName: `platform.${props.rootDomain}`
    });
    
    const ns = Fn.join(",", this.hostedZone.hostedZoneNameServers || []); 
    new CfnOutput(this, "NSRecordForPlatformHostedZone", { value: ns });
  }
}
