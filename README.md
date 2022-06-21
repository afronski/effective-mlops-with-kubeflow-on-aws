# `effective-mlops-with-kubeflow-on-aws`

## What is it?

Scripts and *Infrastructure as Code (IaC)* used for the talk titled "*Effective MLOps with Kubeflow on AWS*". It sets up all the resources needed by the *Kubeflow on AWS* distribution.

## Prerequisites

- `node >= 16.15.1`
- `python >= 3.8`
- `aws-cdk >= 2.28.1`

## Deployment

### Dependencies

```bash
$ make install
$ cd infrastructure && npm install
```

### Setting-up AWS Infrastructure

This is a one-time command per region (e.g., for your choice like `eu-west-1` and `us-east-1`):

```bash
$ cd infrastructure
$ npm run bootstrap
```

After that (or if you already have bootstrapped *AWS CDK* in that account and region), we can deploy shared resources:

```bash
$ npm run deploy-shared-regional-infrastructure
$ npm run deploy-shared-global-infrastructure
```

Now we can push the code to the *AWS CodeCommit* repository that will be used in the 4th step (it's an optional step, *see below*):

```bash
# Push the code to the newly created repository in AWS CodeCommit via regional infrastructure:
$ git remote add aws "...<PUT HERE AWS CODECOMMIT URL FROM CDK DEPLOY OUTPUT>..."
$ git push aws master
```

Then we can deploy the rest of the stuff:

```bash
$ npm run deploy
```

#### Setting-up *AWS Cloud 9 IDE*

When it comes to the IDE and working environment stack - it's used just for demonstration purposes - to prepare a unified environment for the Kubeflow configuration and deployment. If you have [all prerequisites available locally](https://awslabs.github.io/kubeflow-manifests/docs/deployment/prerequisites/), you are free to skip this particular stack. See also [.tool-versions](./.tool-versions) file for exact versions used in this project.

A few things needs to be done to use *AWS Cloud 9* environment properly:

1. Disable *Temporary AWS Credentials* in the *Preferences* inside *AWS Settings* tab.
2. In the same place, change *Auto-Saving Files* on focus change in the *Experimental* tab.
3. Show *Hidden Files* in the sidebar inside *AWS Cloud 9 IDE* (click the *gear icon* on the sidebar).

### Kubeflow deployment

If you are not using *AWS Cloud 9* from 4th step, please make sure you've cloned [awslabs/kubeflow-manifests](https://github.com/awslabs/kubeflow-manifests) locally as it is requested [here](https://awslabs.github.io/kubeflow-manifests/docs/deployment/prerequisites/#clone-the-repository).

Now, we can proceed with the deployment steps.

As a first step we have to log in to the cluster and `update-kubeconfig` (you can find that command in the output values of AWS CloudFormation stack with *EKS*):

```bash
$ aws eks update-kubeconfig --name shared-eks-cluster --region eu-west-1 --role-arn arn:aws:iam::...
$ kubectl create namespace kubeflow
$ kubectl create namespace amazon-cloudwatch
```

Then, we need to create *IRSA* for *AWS SSM* and *AWS Secrets Manager*, and then install *Kubernetes Secrets Store CSI Driver*:

```bash
$ eksctl create iamserviceaccount --name kubeflow-secrets-manager-sa --namespace kubeflow --cluster ${CLUSTER_NAME} --attach-policy-arn  arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess --attach-policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite --override-existing-serviceaccounts --approve --region ${AWS_REGION}

$ kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/secrets-store-csi-driver/v1.0.0/deploy/rbac-secretproviderclass.yaml
$ kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/secrets-store-csi-driver/v1.0.0/deploy/csidriver.yaml
$ kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/secrets-store-csi-driver/v1.0.0/deploy/secrets-store.csi.x-k8s.io_secretproviderclasses.yaml
$ kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/secrets-store-csi-driver/v1.0.0/deploy/secrets-store.csi.x-k8s.io_secretproviderclasspodstatuses.yaml
$ kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/secrets-store-csi-driver/v1.0.0/deploy/secrets-store-csi-driver.yaml
$ kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/secrets-store-csi-driver/v1.0.0/deploy/rbac-secretprovidersyncing.yaml
$ kubectl apply -f https://raw.githubusercontent.com/aws/secrets-store-csi-driver-provider-aws/main/deployment/aws-provider-installer.yaml
```

Next, we will create *IRSA* for *Application Load Balancer (ALB)*, but first - we need add a missing tag (`kubernetes.io/cluster/<CLUSTER_NAME>`):

```bash
$ export TAG_VALUE=owned
$ export CLUSTER_SUBNET_IDS=$(aws ec2 describe-subnets --region ${AWS_REGION} --filters Name=tag:aws:cloudformation:stack-name,Values=KubeflowOnAWS-Shared-Infrastructure --output json | jq -r '.Subnets[].SubnetId')
$ for i in "${CLUSTER_SUBNET_IDS[@]}"; do aws ec2 create-tags --resources ${i} --tags Key=kubernetes.io/cluster/${CLUSTER_NAME},Value=${TAG_VALUE}; done

$ cd ../../kubeflow-manifests

$ export LBC_POLICY_NAME="alb_ingress_controller_${AWS_REGION}_${CLUSTER_NAME}"
$ export LBC_POLICY_ARN=$(aws iam create-policy --policy-name ${LBC_POLICY_NAME} --policy-document file://./awsconfigs/infra_configs/iam_alb_ingress_policy.json --output text --query 'Policy.Arn')
$ eksctl create iamserviceaccount --name aws-load-balancer-controller --namespace kube-system --cluster ${CLUSTER_NAME} --region ${AWS_REGION} --attach-policy-arn ${LBC_POLICY_ARN} --override-existing-serviceaccounts --approve
```

Last, but not least: *IRSA* for *Amazon CloudWatch* and *Fluent Bit*:

```bash
$ eksctl create iamserviceaccount --name cloudwatch-agent --namespace amazon-cloudwatch --cluster ${CLUSTER_NAME} --region ${AWS_REGION} --approve --override-existing-serviceaccounts --attach-policy-arn arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy
$ eksctl create iamserviceaccount --name fluent-bit --namespace amazon-cloudwatch --cluster ${CLUSTER_NAME} --region ${AWS_REGION} --approve --override-existing-serviceaccounts --attach-policy-arn arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy
```

Then, we will install *Fluent Bit* that is integrated with *Amazon CloudWatch*:

```bash
$ export FluentBitHttpPort='2020'
$ export FluentBitReadFromHead='Off'
$ [[ ${FluentBitReadFromHead}='On' ]] && export FluentBitReadFromTail='Off' || export FluentBitReadFromTail='On'
$ [[ -z ${FluentBitHttpPort} ]] && export FluentBitHttpServer='Off' || export FluentBitHttpServer='On'
$ curl https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/latest/k8s-deployment-manifest-templates/deployment-mode/daemonset/container-insights-monitoring/quickstart/cwagent-fluent-bit-quickstart.yaml | sed 's/{{cluster_name}}/'${CLUSTER_NAME}'/;s/{{region_name}}/'${AWS_REGION}'/;s/{{http_server_toggle}}/"'${FluentBitHttpServer}'"/;s/{{http_server_port}}/"'${FluentBitHttpPort}'"/;s/{{read_from_head}}/"'${FluentBitReadFromHead}'"/;s/{{read_from_tail}}/"'${FluentBitReadFromTail}'"/' | kubectl apply -f -
```

Now, we have to configure all the settings:

```bash
$ printf 'clusterName='$CLUSTER_NAME'' > ./awsconfigs/common/aws-alb-ingress-controller/base/params.env

$ export CognitoUserPoolArn="<YOUR_USER_POOL_ARN>"
$ export CognitoAppClientId="<YOUR_APP_CLIENT_ID>"
$ export CognitoUserPoolDomain="<YOUR_USER_POOL_DOMAIN>"
$ export certArn="<YOUR_ACM_CERTIFICATE_ARN>"
$ export signOutURL="<YOUR_SIGN_OUT_URL>"
$ export CognitoLogoutURL="https://$CognitoUserPoolDomain/logout?client_id=$CognitoAppClientId&logout_uri=$signOutURL"
$ printf 'CognitoUserPoolArn='$CognitoUserPoolArn'
CognitoAppClientId='$CognitoAppClientId'
CognitoUserPoolDomain='$CognitoUserPoolDomain'
certArn='$certArn'' > ./awsconfigs/common/istio-ingress/overlays/cognito/params.env

$ printf 'LOGOUT_URL='$CognitoLogoutURL'' > ./awsconfigs/common/aws-authservice/base/params.env

$ export RDS_SECRET="<YOUR_RDS_SECRET_NAME>"
$ yq e -i '.spec.parameters.objects |= sub("rds-secret",env(RDS_SECRET))' ./awsconfigs/common/aws-secrets-manager/rds/secret-provider.yaml

$ export S3_SECRET="<YOUR_S3_SECRET_NAME>"
$ yq e -i '.spec.parameters.objects |= sub("s3-secret",env(S3_SECRET))' ./awsconfigs/common/aws-secrets-manager/s3/secret-provider.yaml

$ export DATABASE_HOST="<YOUR_RDS_HOSTNAME>"
$ printf 'dbHost='${DATABASE_HOST}'
mlmdDb=metadata_db' > ./awsconfigs/apps/pipeline/rds/params.env

$ export BUCKET_NAME="<YOUR_BUCKET_NAME>"
$ printf 'bucketName='${BUCKET_NAME}'
minioServiceHost=s3.amazonaws.com
minioServiceRegion='${AWS_REGION}'' > ./awsconfigs/apps/pipeline/s3/params.env
```

And we can finally build and apply all the changes:

```bash
$ while ! kustomize build ./docs/deployment/cognito-rds-s3 | kubectl apply -f -; do echo "Retrying to apply resources"; sleep 10; done
```

Last, but not least:

- We can update the placeholder *DNS* record in a custom domain with the *ALB* address.
  - `kubectl get ingress -n istio-system`
- Create a user in a *Cognito* user pool.
  - Remember the password used for creating a user, it will be used later.
- Create a profile for the user from the user pool.
  - ```yaml
    apiVersion: kubeflow.org/v1beta1
    kind: Profile
    metadata:
      # Replace with the name of profile you want, this will be user's namespace name.
      name: namespace-for-my-user
      namespace: kubeflow
    spec:
      owner:
        kind: User
        # Replace with the email of the user.
        name: my_user_email@kubeflow.com
    ```
- And finally, connect to the central dashboard.

#### Resources

- [Documentation](https://awslabs.github.io/kubeflow-manifests/docs/deployment/cognito-rds-s3/guide/)

## License

- [MIT](LICENSE.md)

## Authors

I am [Wojciech Gawroński (AWS Maniac)](https://awsmaniac.com) - in case of any questions, you can drop me a line over [email](mailto:hello@awsmaniac.com).
