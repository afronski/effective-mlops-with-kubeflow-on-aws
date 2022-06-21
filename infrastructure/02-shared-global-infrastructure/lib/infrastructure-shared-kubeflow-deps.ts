import { RemovalPolicy, SecretValue, Stack, Tags } from "aws-cdk-lib";
import { Construct } from "constructs";

import { Certificate, CertificateValidation } from "aws-cdk-lib/aws-certificatemanager";
import { SecurityGroup, SubnetType, Peer, Port } from "aws-cdk-lib/aws-ec2";
import { AccessKey, User } from "aws-cdk-lib/aws-iam"; 
import { Credentials, DatabaseInstance, DatabaseInstanceEngine, MysqlEngineVersion } from "aws-cdk-lib/aws-rds";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";

import * as statement from "cdk-iam-floyd";

import { InfrastructureSharedKubeflowDepsProps } from "./props/infrastructure-shared-kubeflow-deps-props";

export class InfrastructureSharedKubeflowDepsStack extends Stack {
  constructor (scope: Construct, id: string, props: InfrastructureSharedKubeflowDepsProps) {
    super(scope, id, props);
    
    const { region } = Stack.of(this);

    // Amazon S3 Bucket for Kubeflow Storage.
  
    const storageLayerBucket = new Bucket(this, "KubeflowStorageBucket", {
      bucketName: `kubeflow-storage-${region}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL
    });
    
    storageLayerBucket.applyRemovalPolicy(RemovalPolicy.DESTROY);
    
    // Amazon RDS (MySQL) instance with secrets to store Kubeflow Pipelines and Katib metadata,
    // and AWS Secrets Manager entry for this database instance.
    
    const DATABASE_PORT = 3306;
    const DATABASE_NAME = "kubeflow";
    const DATABASE_USER_NAME = "admin";
    
    const securityGroupName = "Kubeflow-Private-MySQL-SecurityGroup";
    const securityGroup = new SecurityGroup(this, "VPCPrivateAccessToMySQL", {
      securityGroupName,
      vpc: props.vpc,
      allowAllOutbound: true
    });

    securityGroup.addIngressRule(Peer.ipv4(props.vpc.vpcCidrBlock), Port.tcp(DATABASE_PORT));

    Tags.of(securityGroup).add("Name", securityGroupName);
    
    const databaseSecret = new Secret(this, "KubeflowMetadataDatabaseCredentialsSecret", {
      secretName: "kubeflow-metadata-database-credentials",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ 
          user: DATABASE_USER_NAME,
          username: DATABASE_USER_NAME,
          database: DATABASE_NAME
        }),
        generateStringKey: "password",
        excludePunctuation: true,
        includeSpace: false
      }
    });
    
    databaseSecret.applyRemovalPolicy(RemovalPolicy.DESTROY);
    
    const database = new DatabaseInstance(this, "KubeflowMetadataDatabaseInstance", {
      engine: DatabaseInstanceEngine.mysql({ version: MysqlEngineVersion.VER_5_7_37 }),
      
      vpc: props.vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_NAT },
      securityGroups: [ securityGroup ],
      
      credentials: Credentials.fromSecret(databaseSecret),
      databaseName: DATABASE_NAME,
      port: DATABASE_PORT
    });
    
    database.applyRemovalPolicy(RemovalPolicy.DESTROY);
    
    // IAM User with Access Key that will be used for S3 interaction for Kubeflow Storage layer.
    
    const user = new User(this, "UserWithAmazonS3Access", {
      userName: "kubeflow-storage-user"
    });
  
    user.addToPolicy(
      new statement.S3()
        .allow()
        .onAllResources()
        .toListAllMyBuckets()
    );
    
    user.addToPolicy(
      new statement.S3()
        .allow()
        .on(storageLayerBucket.bucketArn)
        .toListBucket()
    );
    
    user.addToPolicy(
      new statement.S3()
        .allow()
        .on(`${storageLayerBucket.bucketArn}/*`)
        .toGetObject()
        .toPutObject()
        .toGetObjectAcl()
        .toPutObjectAcl()
        .toDeleteObject()
    );
    
    const accessKey = new AccessKey(this, "AccessKeyForUserWithAmazonS3Access", { user });
    
    // AWS Secrets Manager entry for Amazon S3 access through IAM User credentials.
    
    const storageSecret = new Secret(this, "KubeflowStorageLayerCredentialsSecret", {
      secretName: "kubeflow-storage-layer-credentials",
      secretStringValue: SecretValue.unsafePlainText(JSON.stringify({
        accesskey: accessKey.accessKeyId,
        secretkey: accessKey.secretAccessKey.unsafeUnwrap(),
      }))
    });
    
    storageSecret.applyRemovalPolicy(RemovalPolicy.DESTROY);
    
    // Public certificates in AWS ACM for the same region where cluster is,
    // with DNS validation entries in the hosted zone created above.
    
    new Certificate(this, "WildcardRegionalPlatformCertificate", {
      domainName: `*.platform.${props.rootDomain}`,
      validation: CertificateValidation.fromDns(props.hostedZone),
    });
    
    new Certificate(this, "WildcardRegionalCertificate", {
      domainName: `*.${props.rootDomain}`,
      validation: CertificateValidation.fromDns(props.hostedZone),
    });
    
    // Amazon Cognito user pool, client, and relevant configuration.
  }
}
