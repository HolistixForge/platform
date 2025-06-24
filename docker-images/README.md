# Install AWS cli

```bash
$ cd /tmp
$ curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
$ sudo apt install -y unzip
$ unzip awscliv2.zip
$ sudo ./aws/install
$ rm -rf aws awscliv2.zip

$ aws configure
AWS Access Key ID [None]: XXXXXXXXXXXXXXXX
AWS Secret Access Key [None]: XXXXXXXXXXXXXXXXXXXXXXXXXX
Default region name [None]: eu-west-3
Default output format [None]:
```

# Setup Docker Login

> [!IMPORTANT]
> use AWS region us-east-1 in the following command.
>
> ecr-public auth works only on this region.

```bash
$ aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws
```

# Build

```bash
$ docker build -f ./xxxxx/Dockerfile . -t ${IMAGE_NAME}:${IMAGE_TAG}
```

# Push

```bash
$ PUBLIC_REGISTRY_ID=f3g9x7j4
$ docker tag ${IMAGE_NAME}:${IMAGE_TAG} public.ecr.aws/${PUBLIC_REGISTRY_ID}/${IMAGE_NAME}:${IMAGE_TAG}
$ docker push public.ecr.aws/${PUBLIC_REGISTRY_ID}/${IMAGE_NAME}:${IMAGE_TAG}
```

# Pull

```bash
$ docker pull public.ecr.aws/${PUBLIC_REGISTRY_ID}/${IMAGE_NAME}:${IMAGE_TAG}
```
