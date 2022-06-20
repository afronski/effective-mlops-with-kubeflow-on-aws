# AWS CDK infrastructure for `effective-mlops-with-kubeflow-on-aws` project

## Prerequisites

- `node >= 16.15.1`
- `python >= 3.8.10`
- `npm install -g aws-cdk`
  - `cdk >= 2.28.1`

## How to start?

```bash
$ make install

$ cd infrastructure
$ npm install
```

## Deployment

### AWS Infrastructure

```bash
$ npm run package

$ npm run bootstrap
$ npm run deploy-shared-infrastructure

# Push the code to the newly created repository in AWS CodeCommit:
$ git remote add aws ...
$ git push aws master

$ npm run deploy
```

### Kubeflow

```bash
```

## License

- [MIT](LICENSE.md)

## Authors

I am [Wojciech Gawroński (AWS Maniac)](https://awsmaniac.com) - in case of any questions, you can drop me a line over [email](mailto:hello@awsmaniac.com).
