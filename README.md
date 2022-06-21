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

$ cd infrastructure/01-shared-regional-infrastructure && npm install
$ cd infrastructure/02-shared-global-infrastructure && npm install
$ cd infrastructure/03-kubeflow-dependencies && npm install
```

### Setting-up AWS Infrastructure

#### Shared regional infrastructure

This is a one-time command per region (e.g., for your choice like `eu-west-1` and `us-east-1`):

```bash
$ cd infrastructure/01-shared-regional-infrastructure
$ npm run bootstrap
```

After that (or if you already have bootstrapped *AWS CDK* in that account and region), we can deploy resources:

```bash
$ cd infrastructure/01-shared-regional-infrastructure
$ npm run deploy
```

Now we can push the code to the *AWS CodeCommit* repository that will be used in the 4th step (it's an optional step, *see below*):

```bash
# Push the code to the newly created repository in AWS CodeCommit:
$ git remote add aws "...<PUT HERE AWS CODECOMMIT URL FROM CDK DEPLOY OUTPUT>..."
$ git push aws master
```

#### Shared global infrastructure

```bash
$ cd infrastructure/02-shared-global-infrastructure
$ npm run deploy
```

#### Kubeflow dependencies

```bash
$ cd infrastructure/03-kubeflow-dependencies
$ npm run deploy
```

#### Working environment

**This step is optional**. It's used just for demonstration purposes - to prepare a unified environment for the Kubeflow configuration and deployment. If you have [all prerequisites available locally](https://awslabs.github.io/kubeflow-manifests/docs/deployment/prerequisites/), you are free to skip it. See also [.tool-versions](./.tool-versions) file for exact versions used in this project.

```bash
$ cd infrastructure/04-working-environment
$ npm run deploy
```

##### Setting-up *AWS Cloud 9 IDE*

1. Disable *Temporary AWS Credentials* in the *Preferences* inside *AWS Settings* tab.
2. In the same place, change *Auto-Saving Files* on focus change in the *Experimental* tab.
3. Show *Hidden Files* in the sidebar inside *AWS Cloud 9 IDE* (click the *gear icon* on the sidebar).

### Kubeflow deployment

```bash
```

## License

- [MIT](LICENSE.md)

## Authors

I am [Wojciech Gawroński (AWS Maniac)](https://awsmaniac.com) - in case of any questions, you can drop me a line over [email](mailto:hello@awsmaniac.com).
