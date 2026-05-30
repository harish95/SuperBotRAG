import argparse
import logging
import os
import sagemaker
from sagemaker.huggingface import HuggingFaceModel
from sagemaker.serverless import ServerlessInferenceConfig

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("sagemaker-deployer")


def deploy_model(role_arn: str, region: str) -> None:
    logger.info(f"Initializing SageMaker session in region {region}...")
    
    # Initialize SageMaker session
    boto_session = sagemaker.Session().boto_session
    sagemaker_session = sagemaker.Session(boto_session=boto_session)

    # Configuration for Hugging Face Cross-Encoder Reranker
    hub = {
        "HF_MODEL_ID": "BAAI/bge-reranker-base",
        "HF_TASK": "text-classification"  # Cross-encoders belong to text-classification pipeline
    }

    logger.info("Creating HuggingFaceModel definition...")
    # Create HuggingFaceModel definition
    hf_model = HuggingFaceModel(
        env=hub,
        role=role_arn,
        transformers_version="4.37.0",
        pytorch_version="2.1.0",
        py_version="py310",
        sagemaker_session=sagemaker_session
    )

    logger.info("Configuring Serverless Inference setting (3GB RAM, Max Concurrency = 5)...")
    # Define serverless config - 3GB is the account quota limit for serverless endpoints
    # NOTE: bge-reranker-base OOMs at 3GB. Request quota increase to 6GB before re-enabling.
    serverless_config = ServerlessInferenceConfig(
        memory_size_in_mb=3072,
        max_concurrency=5
    )

    endpoint_name = "bge-reranker-endpoint"
    logger.info(f"Deploying model to endpoint: {endpoint_name}...")
    
    try:
        # Deploy model to serverless endpoint
        hf_model.deploy(
            endpoint_name=endpoint_name,
            serverless_inference_config=serverless_config
        )
        logger.info(f"Successfully deployed BGE-Reranker model to SageMaker Serverless Inference!")
        logger.info(f"Endpoint name: {endpoint_name}")
    except Exception as e:
        logger.error(f"Deployment failed: {e}")
        raise e


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deploy BAAI/bge-reranker-base to AWS SageMaker Serverless Endpoint.")
    parser.add_argument(
        "--role-arn",
        type=str,
        required=True,
        help="ARN of the AWS IAM Role containing AmazonSageMakerFullAccess permissions."
    )
    parser.add_argument(
        "--region",
        type=str,
        default="ap-south-1",
        help="AWS Region to deploy model (default: us-east-1)."
    )
    args = parser.parse_args()

    os.environ["AWS_DEFAULT_REGION"] = args.region
    deploy_model(args.role_arn, args.region)
