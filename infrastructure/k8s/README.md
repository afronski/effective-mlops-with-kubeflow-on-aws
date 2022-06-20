# Operating *Amazon EKS* shared cluster

## Setting up your environment

First, and foremost - we need to update `kubeconfig`:

```bash
$ aws eks update-kubeconfig --name shared-eks-cluster                                                 \
                            --region eu-west-1                                                        \
                            --role-arn arn:aws:iam::383430062921:role/workshop-sagemaker-mlops-...
```

You can find that command in the output values of *AWS CloudFormation* stack called
`workshop-sagemaker-mlops-shared-eks-cluster` (via *AWS Management Console*) or with this command:

```bash
$ aws cloudformation describe-stacks                                                                          \
                    --stack-name workshop-sagemaker-mlops-shared-eks-cluster                                  \
                    --query "Stacks[0].Outputs[?starts_with(OutputKey, 'SharedEKSClusterConfigCommand')]"
```

After successful update of our settings we should be able to list clusters with `eksctl`:

```bash
$ eksctl get clusters
2021-10-30 17:04:14 [ℹ]  eksctl version 0.70.0
2021-10-30 17:04:14 [ℹ]  using region eu-west-1
NAME                    REGION          EKSCTL CREATED
shared-eks-cluster      eu-west-1       False
```

And the same with `kubectl`:

```bash
$ kubectl get nodes -o wide
NAME                                         STATUS   ROLES    AGE    VERSION               INTERNAL-IP    ...
ip-10-0-120-136.eu-west-1.compute.internal   Ready    <none>   131m   v1.21.4-eks-033ce7e   10.0.120.136   ...
ip-10-0-133-6.eu-west-1.compute.internal     Ready    <none>   131m   v1.21.4-eks-033ce7e   10.0.133.6     ...
ip-10-0-176-152.eu-west-1.compute.internal   Ready    <none>   131m   v1.21.4-eks-033ce7e   10.0.176.152   ...
```

## Installing *Kubernetes Metrics Server* on *Amazon EKS* (**OPTIONAL**)

**This is optional, as it's already preinstalled by the lecturer and ready to use during the workshop**.

We need to apply a manifest file as follows:

```bash
$ kubectl apply -f ./eks-k8s-metrics-server.yaml
```

After successful application you can verify that `metrics-server` deployment is running the desired number of pods:

```bash
$ kubectl get deployment metrics-server -n kube-system
```

## Installing *Kubernetes Dashboard* on *Amazon EKS* (**OPTIONAL**)

**This is optional, as it's already preinstalled by the lecturer and ready to use during the workshop**.

We need to apply a manifest files as follows:

```bash
$ kubectl apply -f ./eks-k8s-dashboard.yaml
$ kubectl apply -f ./eks-admin-service-account.yaml
```

After successful application we can connect to the dashboard as follows:

```bash
$ kubectl -n kube-system describe secret $(kubectl -n kube-system get secret | grep eks-admin | awk '{print $1}')
$ kubectl port-forward svc/kubernetes-dashboard -n kubernetes-dashboard 8080:80
```

Then, in your *AWS Cloud9* environment, click `Tools / Preview / Preview Running Application` to access dashboard
under the following address: `http://localhost:8080`.

You can click on *Pop out window* button to maximize browser into new tab. Do not close the terminal windows, because
you will drop the connection. After opening website, you can paste `token` from the command used for describing secrets
and sign-in to the *Kubernetes Dashboard* web application.

## Installing and configuring *Kubeflow* on *Amazon EKS* (**OPTIONAL**)

**This is optional, as it's already preinstalled by the lecturer and ready to use during the workshop**.

### Installing *Kubeflow* on *Amazon EKS*

First, make sure that you are invoking `kfctl` command with the *IAM* user permissions that have associated
`system:masters` *RBAC* role.

Then, we have to apply the manifest:

```bash
$ kfctl apply -V -f ./eks-kubeflow.yaml
```

After 2-3 minutes we can verify that all pods are running correctly:

```bash
$ kubectl -n kubeflow get all
```

Then, we have to create individual users (remember to create and enable `virtualenv` from the repository root):

```bash
$ kubectl get configmap dex -n auth -o yaml | python ./scripts/replace_static_passwords.py | kubectl replace -f -
$ kubectl rollout restart deployment dex -n auth
$ kubectl get pods -n auth
```

And now we are ready to log-in into *Kubeflow Dashboard* - do that for every single user you need and create an
associated namespace for each user (where its name is equal to the `userXYZ` identifier).

### Configuring permissions for *Kubeflow* pods

First, make sure that you will be invoking following commands with the *IAM* user permissions that have associated
`system:masters` *RBAC* role. In order to properly invoke *AWS API* calls from the inside of the *Kubeflow* pods we
need to prepare *Kubeflow Pipelines* execution role. We can do that by invoking prepared script:

```bash
$ ./scripts/configure-irsa-for-kubeflow-pipeline-runner-pods.sh
```

When the script succeeds, we need to restart all pods in `kubeflow` namespace and `aws-node-*` in `kube-system`:

```bash
$ kubectl delete pods -n kubeflow --all
$ kubectl delete pods -n kube-system -l k8s-app=aws-node
```

After successful restart everything should be ready to run pipelines without any *AWS IAM* permission errors. If by any
chance the annotation would disappear, you can do the following (examples for `user001`):

1. Find the *IAM Role* association to namespace via following command:
   ```bash
   $ eksctl get iamserviceaccount --cluster shared-eks-cluster | grep user001
   ```
2. Annotate the service account again:
   ```bash
   $ kubectl annotate serviceaccount -n "user001" default-editor "eks.amazonaws.com/role-arn=<ROLE_ARN_FROM_ABOVE>"
   ```

## How to open *Kubeflow* dashboard that is hosted on *Amazon EKS*?

We need to use port forwarding to our *AWS Cloud9* instance:

```bash
$ kubectl port-forward svc/istio-ingressgateway -n istio-system 8080:80
```

Then, in your *AWS Cloud9* environment, click `Tools / Preview / Preview Running Application` to access dashboard
under the following address: `http://localhost:8080`

You can click on *Pop out window* button to maximize browser into new tab. Leave the current terminal running because
if you kill the process, you will lose access to the dashboard. Open new terminal to follow rest of the workshop.

During the first log-in it will ask you about creating namespace - **you should provide your user identified (e.g.
`user001`) as a name**.
