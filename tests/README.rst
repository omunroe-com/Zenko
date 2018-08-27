=========
zenko_e2e
=========

A suite of End-to-End tests for Zenko.

Quickstart
----------

**Setting up the environment**

To be able to install charts and launch tests into the kubernetes cluster,
helm and kubectl must be configured to manage the target cluster.

Change the variable ``IMAGE_REPO`` in ``.local.env`` to a docker hub user you control.

Copy and fill in ``.secrets.env``

``cp .secrets.env.example .secrets.env && vim .secrets.env``

Source your environment files

``source .env && source .secrets.env && source .local.env``

Run the tests

``make -e test``

**Pre-installed Zenko**

Install and deploy Zenko as normal.

Configure it using Orbit

You may need to make changes to ``.env`` to reflect the buckets and backends you have configured manually

Change the variable ``IMAGE_REPO`` in ``.local.env`` to a docker hub user you control.

Copy and fill in ``.secrets.env``
``cp .secrets.env.example .secrets.env && vim .secrets.env``

Source your environment files
``source .env && source .secrets.env && source .local.env``

Run the tests
``make -e test-local``

Environment variables
---------------------

Tests are configured using two environment files:
``.env`` for common config and ``.secrets.env`` for sensitive info.

| A ``.env`` file is provided in the tests directory prefilled with info matching the CI.
| A skeleton ``.secrets.env`` is available as ``.secrets.env.example``.

`Variables are shown with default values.`

| **Backend Config**
| Backing cloud buckets are configured using:

::

    AWS_BUCKET_NAME=ci-zenko-aws-target-bucket
    AWS_BUCKET_NAME_2=ci-zenko-aws-target-bucket-2
    AWS_CRR_BUCKET_NAME=ci-zenko-aws-crr-target-bucket

    GCP_BUCKET_NAME=ci-zenko-gcp-target-bucket
    GCP_BUCKET_NAME_2=ci-zenko-gcp-target-bucket-2
    GCP_MPU_BUCKET_NAME=ci-zenko-gcp-mpu-bucket
    GCP_MPU_BUCKET_NAME_2=ci-zenko-gcp-mpu-bucket-2
    GCP_CRR_BUCKET_NAME=ci-zenko-gcp-crr-target-bucket
    GCP_CRR_MPU_BUCKET_NAME=ci-zenko-gcp-crr-mpu-bucket

    AZURE_BUCKET_NAME=ci-zenko-azure-target-bucket
    AZURE_BUCKET_NAME_2=ci-zenko-azure-target-bucket-2
    AZURE_CRR_BUCKET_NAME=ci-zenko-azure-crr-target-bucket



Source buckets for crr are configured using:

::

    AWS_CRR_SRC_BUCKET_NAME=ci-zenko-aws-crr-src-bucket
    GCP_CRR_SRC_BUCKET_NAME=ci-zenko-gcp-crr-src-bucket
    AZURE_CRR_SRC_BUCKET_NAME=ci-zenko-azure-crr-src-bucket
    MULTI_CRR_SRC_BUCKET_NAME=ci-zenko-multi-crr-src-bucket
    TRANSIENT_SRC_BUCKET_NAME=ci-transient-src-bucket

Backbeat test locations are configured using:

::

    AWS_BACKEND_SOURCE_LOCATION=awsbackend
    AWS_BACKEND_DESTINATION_LOCATION=awsbackendmismatch
    GCP_BACKEND_DESTINATION_LOCATION=gcpbackendmismatch
    AZURE_BACKEND_DESTINATION_LOCATION=azurebackendmismatch
    LOCATION_QUOTA_BACKEND=quotabackend

Cloud access and secret keys are configured using:

::

    AWS_ACCESS_KEY=<ACCESS_KEY>
    AWS_SECRET_KEY=<SECRET_KEY>
    AWS_ACCESS_KEY_2=<ACCESS_KEY>
    AWS_SECRET_KEY_2=<SECRET_KEY>
    AWS_CRR_ACCESS_KEY=<ACCESS_KEY>
    AWS_CRR_SECRET_KEY=<SECRET_KEY>

    GCP_ACCESS_KEY=<ACCESS_KEY>
    GCP_SECRET_KEY=<SECRET_KEY>
    GCP_ACCESS_KEY_2=<ACCESS_KEY>
    GCP_SECRET_KEY_2=<SECRET_KEY>
    GCP_BACKEND_SERVICE_EMAIL=<SERVICE_EMAIL>
    GCP_BACKEND_SERVICE_KEY=<SERVICE_KEY>

    AZURE_ACCOUNT_NAME=<ACCOUNT_NAME>
    AZURE_BACKEND_ENDPOINT=https://<ACCOUNT_NAME>.blob.core.windows.net
    AZURE_SECRET_KEY=<ACCESS_KEY>
    AZURE_ACCOUNT_NAME_2=<ACCOUNT_NAME>
    AZURE_BACKEND_ENDPOINT_2=https://<ACCOUNT_NAME>.blob.core.windows.net
    AZURE_SECRET_KEY_2=<ACCESS_KEY>


| **Zenko Config**
| Defines access keys to use when calling Zenko endpoints:

::

    ZENKO_ACCESS_KEY=HEYIMAACCESSKEY
    ZENKO_SECRET_KEY=loOkAtMEImASecRetKEy123=

| **Test Config**
| Define params used when installing and interacting with the k8s deployment.
| Use them to control test setup and behavior. Useful for local runs
| *These variables are optional and only used to override defaults.*
| Shown as `<VAR_NAME> : <default>`

ZENKO_HELM_RELEASE : zenko-test
    Helm release used to install Zenko

ORBIT_HELM_RELEASE : ciutil
    Helm release used to install orbit-simulator

HELM_NAMESPACE : test-namespace
    Helm namespace used to install and run all containers

INSTALL_TIMEOUT : 600
    How long to wait for Zenko to stabalize after installation.
    In seconds.

IMAGE_REGISTRY : docker.io
    Used to control the docker registry where built images will be pushed

IMAGE_REPO : zenko
    Used to control the repo (user) images are tagged using

TAG_OVERRIDE : latest
    Used to control the tag used for built images

VERBOSE :
    If variable is set, don't suppress make commands with ``@``

NO_SIM :
    If variable is set, don't install the orbit-simulator during test setup

NO_INSTALL :
    If set, don't install a Zenko cluster during test setup
