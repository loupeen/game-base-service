import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { GameBaseServiceConfig } from '../config/environment-config';
export interface BaseGameMonitoringConstructProps {
    environment: string;
    config: GameBaseServiceConfig;
    lambdas: NodejsFunction[];
    api: apigateway.RestApi;
}
/**
 * Base Game Monitoring Construct
 *
 * Implements comprehensive monitoring for base service following SOLID principles:
 * - Single Responsibility: Only handles monitoring and alerting
 * - Open/Closed: Easy to add new metrics without modifying existing ones
 * - Liskov Substitution: All monitoring components follow consistent patterns
 * - Interface Segregation: Separate monitoring for different concerns
 * - Dependency Inversion: Depends on CloudWatch abstractions
 *
 * Monitoring Features:
 * - Lambda function performance metrics
 * - API Gateway performance and error tracking
 * - DynamoDB performance monitoring
 * - Custom business metrics (base creation rate, upgrade success, etc.)
 * - Cost monitoring and budget alerts
 * - Operational dashboards
 * - Automated alerting via SNS
 */
export declare class BaseGameMonitoringConstruct extends Construct {
    readonly dashboard: cloudwatch.Dashboard;
    readonly alertTopic: sns.Topic;
    constructor(scope: Construct, id: string, props: BaseGameMonitoringConstructProps);
    private createAlertTopic;
    private createDashboard;
    private createApiGatewayWidgets;
    private createLambdaWidgets;
    private createBusinessMetricWidgets;
    private createLambdaAlarms;
    private createApiGatewayAlarms;
    private createBusinessMetricAlarms;
    private createCostMonitoring;
}
