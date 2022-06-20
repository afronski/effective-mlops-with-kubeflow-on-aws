#!/usr/bin/env bash

CLUSTER_NAME="shared-eks-cluster"

SAGEMAKER_MANAGED_ROLE_ARN="arn:aws:iam::aws:policy/AmazonSageMakerFullAccess"

eksctl create iamserviceaccount --name "pipeline-runner" --namespace "kubeflow" --cluster "${CLUSTER_NAME}"         \
                                --attach-policy-arn "${SAGEMAKER_MANAGED_ROLE_ARN}"                                 \
                                --approve --override-existing-serviceaccounts

eksctl create iamserviceaccount --name "default-editor" --namespace "admin" --cluster "${CLUSTER_NAME}"             \
                                --attach-policy-arn "${SAGEMAKER_MANAGED_ROLE_ARN}"                                 \
                                --approve --override-existing-serviceaccounts

for I in $(seq -f "%03g" 15); do
    eksctl create iamserviceaccount --name "default-editor" --namespace "user${I}" --cluster "shared-eks-cluster"   \
                                --attach-policy-arn "${SAGEMAKER_MANAGED_ROLE_ARN}"                                 \
                                --approve --override-existing-serviceaccounts
done
