/**
 * CDK Custom Resource Lambda Function
 * Seeds the BASE_TEMPLATES_TABLE with initial base template data
 *
 * This Lambda function is invoked during CDK deployment to populate
 * the DynamoDB table with required game data using shared utilities.
 */
export declare const handler: (event: any) => Promise<any>;
