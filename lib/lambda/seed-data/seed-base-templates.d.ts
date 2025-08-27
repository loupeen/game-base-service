/**
 * CDK Custom Resource Lambda Function
 * Seeds the BASE_TEMPLATES_TABLE with initial base template data
 *
 * This Lambda function is invoked during CDK deployment to populate
 * the DynamoDB table with required game data.
 */
import { CloudFormationCustomResourceEvent, CloudFormationCustomResourceResponse } from 'aws-lambda';
export declare const handler: (event: CloudFormationCustomResourceEvent) => Promise<CloudFormationCustomResourceResponse>;
