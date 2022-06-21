import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";

import { InstanceClass, InstanceSize, InstanceType, Peer, Port, SubnetType } from "aws-cdk-lib/aws-ec2";
import { Cluster, EndpointAccess, KubernetesVersion } from "aws-cdk-lib/aws-eks";
import { User } from "aws-cdk-lib/aws-iam";

import { InfrastructureSharedEKSClusterProps } from "./props/infrastructure-shared-eks-cluster-props";

export class InfrastructureSharedEKSClusterStack extends Stack {
  constructor (scope: Construct, id: string, props: InfrastructureSharedEKSClusterProps) {
    super(scope, id, props);

    const k8s = new Cluster(this, "SharedEKSCluster", {
      clusterName: "shared-eks-cluster",

      version: KubernetesVersion.V1_21,

      defaultCapacity: 3,
      defaultCapacityInstance: InstanceType.of(InstanceClass.M5, InstanceSize.XLARGE),

      endpointAccess: EndpointAccess.PRIVATE,
      vpcSubnets: [ { subnetType: SubnetType.PRIVATE_WITH_NAT } ],
      vpc: props.vpc
    });

    const root = User.fromUserName(this, "root", props.userName);

    k8s.awsAuth.addUserMapping(root, { groups: [ "system:masters" ] });

    // For private Amazon EKS clusters we need to update ingress rules with CIDR of our Amazon VPC.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [ controlPlaneSecurityGroup, ...rest ] =
      k8s.connections
        .securityGroups
        .filter((group) => group.node.id === "ControlPlaneSecurityGroup");

    controlPlaneSecurityGroup.addIngressRule(Peer.ipv4(props.vpc.vpcCidrBlock), Port.tcp(443));
    controlPlaneSecurityGroup.addIngressRule(Peer.ipv4(props.vpc.vpcCidrBlock), Port.tcp(80));
  }
}
