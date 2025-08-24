import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as budgets from 'aws-cdk-lib/aws-budgets';
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
export class BaseGameMonitoringConstruct extends Construct {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly alertTopic: sns.Topic;
  
  constructor(scope: Construct, id: string, props: BaseGameMonitoringConstructProps) {
    super(scope, id);

    const { environment, config, lambdas, api } = props;

    // Create SNS topic for alerts
    this.alertTopic = this.createAlertTopic(environment);

    // Create CloudWatch dashboard
    this.dashboard = this.createDashboard(environment, lambdas, api);

    // Create Lambda monitoring alarms
    this.createLambdaAlarms(lambdas, config);

    // Create API Gateway monitoring alarms
    this.createApiGatewayAlarms(api, config);

    // Create custom business metric alarms
    this.createBusinessMetricAlarms(config);

    // Create cost monitoring
    this.createCostMonitoring(environment, config);
  }

  private createAlertTopic(environment: string): sns.Topic {
    return new sns.Topic(this, 'AlertTopic', {
      topicName: `game-base-service-alerts-${environment}`,
      displayName: `Game Base Service Alerts (${environment})`,
      // TODO: Add email subscriptions based on environment
      // For now, alerts go to CloudWatch only
    });
  }

  private createDashboard(
    environment: string,
    lambdas: NodejsFunction[],
    api: apigateway.RestApi
  ): cloudwatch.Dashboard {
    const dashboard = new cloudwatch.Dashboard(this, 'ServiceDashboard', {
      dashboardName: `GameBaseService-${environment}`,
      periodOverride: cloudwatch.PeriodOverride.AUTO
    });

    // API Gateway metrics
    const apiMetrics = this.createApiGatewayWidgets(api);
    
    // Lambda metrics
    const lambdaMetrics = this.createLambdaWidgets(lambdas);
    
    // Custom business metrics
    const businessMetrics = this.createBusinessMetricWidgets(environment);

    // Layout dashboard
    dashboard.addWidgets(
      // First row: API Gateway overview
      new cloudwatch.GraphWidget({
        title: 'API Gateway Overview',
        width: 24,
        height: 6,
        left: [
          apiMetrics.requestCount,
          apiMetrics.successRate
        ],
        right: [
          apiMetrics.latency,
          apiMetrics.errorRate
        ]
      })
    );

    dashboard.addWidgets(
      // Second row: Lambda performance
      new cloudwatch.GraphWidget({
        title: 'Lambda Performance',
        width: 12,
        height: 6,
        left: lambdaMetrics.duration,
        right: lambdaMetrics.errors
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Invocations',
        width: 12,
        height: 6,
        left: lambdaMetrics.invocations,
        right: lambdaMetrics.throttles
      })
    );

    dashboard.addWidgets(
      // Third row: Business metrics
      new cloudwatch.GraphWidget({
        title: 'Base Creation Activity',
        width: 12,
        height: 6,
        left: [businessMetrics.baseCreations]
      }),
      new cloudwatch.GraphWidget({
        title: 'Base Operations',
        width: 12,
        height: 6,
        left: [
          businessMetrics.baseUpgrades,
          businessMetrics.baseMoves
        ]
      })
    );

    return dashboard;
  }

  private createApiGatewayWidgets(api: apigateway.RestApi) {
    const apiName = api.restApiName;
    
    return {
      requestCount: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: 'Count',
        dimensionsMap: {
          ApiName: apiName
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5)
      }),

      successRate: new cloudwatch.MathExpression({
        expression: '100 - (4XX + 5XX) / Count * 100',
        usingMetrics: {
          'Count': new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Count',
            dimensionsMap: { ApiName: apiName }
          }),
          '4XX': new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '4XXError',
            dimensionsMap: { ApiName: apiName }
          }),
          '5XX': new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '5XXError',
            dimensionsMap: { ApiName: apiName }
          })
        },
        label: 'Success Rate (%)'
      }),

      latency: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: 'Latency',
        dimensionsMap: {
          ApiName: apiName
        },
        statistic: 'Average'
      }),

      errorRate: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5XXError',
        dimensionsMap: {
          ApiName: apiName
        },
        statistic: 'Sum'
      })
    };
  }

  private createLambdaWidgets(lambdas: NodejsFunction[]) {
    const lambdaMetrics = lambdas.map(lambda => ({
      duration: new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'Duration',
        dimensionsMap: {
          FunctionName: lambda.functionName
        }
      }),
      errors: new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'Errors',
        dimensionsMap: {
          FunctionName: lambda.functionName
        }
      }),
      invocations: new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'Invocations',
        dimensionsMap: {
          FunctionName: lambda.functionName
        }
      }),
      throttles: new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'Throttles',
        dimensionsMap: {
          FunctionName: lambda.functionName
        }
      })
    }));

    return {
      duration: lambdaMetrics.map(m => m.duration),
      errors: lambdaMetrics.map(m => m.errors),
      invocations: lambdaMetrics.map(m => m.invocations),
      throttles: lambdaMetrics.map(m => m.throttles)
    };
  }

  private createBusinessMetricWidgets(environment: string) {
    return {
      baseCreations: new cloudwatch.Metric({
        namespace: 'GameBaseService/Business',
        metricName: 'BaseCreated',
        dimensionsMap: {
          Environment: environment
        },
        statistic: 'Sum'
      }),

      baseUpgrades: new cloudwatch.Metric({
        namespace: 'GameBaseService/Business',
        metricName: 'BaseUpgraded',
        dimensionsMap: {
          Environment: environment
        },
        statistic: 'Sum'
      }),

      baseMoves: new cloudwatch.Metric({
        namespace: 'GameBaseService/Business',
        metricName: 'BaseMoved',
        dimensionsMap: {
          Environment: environment
        },
        statistic: 'Sum'
      })
    };
  }

  private createLambdaAlarms(lambdas: NodejsFunction[], config: GameBaseServiceConfig): void {
    lambdas.forEach((lambdaFunction, index) => {
      const functionName = lambdaFunction.functionName;
      
      // Error rate alarm
      new cloudwatch.Alarm(this, `LambdaErrorAlarm${index}`, {
        alarmName: `${functionName}-error-rate`,
        alarmDescription: `High error rate for ${functionName}`,
        metric: new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Errors',
          dimensionsMap: {
            FunctionName: functionName
          },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5)
        }),
        threshold: config.monitoring.alarmThresholds.errorRate,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
      }).addAlarmAction(new cloudwatch.SnsAction(this.alertTopic));

      // Duration alarm
      new cloudwatch.Alarm(this, `LambdaDurationAlarm${index}`, {
        alarmName: `${functionName}-high-duration`,
        alarmDescription: `High duration for ${functionName}`,
        metric: new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Duration',
          dimensionsMap: {
            FunctionName: functionName
          },
          statistic: 'Average',
          period: cdk.Duration.minutes(5)
        }),
        threshold: config.monitoring.alarmThresholds.latencyMs,
        evaluationPeriods: 3,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
      }).addAlarmAction(new cloudwatch.SnsAction(this.alertTopic));
    });
  }

  private createApiGatewayAlarms(api: apigateway.RestApi, config: GameBaseServiceConfig): void {
    // 5XX Error alarm
    new cloudwatch.Alarm(this, 'ApiGateway5XXAlarm', {
      alarmName: `${api.restApiName}-5xx-errors`,
      alarmDescription: 'High 5XX error rate for API Gateway',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5XXError',
        dimensionsMap: {
          ApiName: api.restApiName
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5)
      }),
      threshold: 5, // 5 errors in 5 minutes
      evaluationPeriods: 2
    }).addAlarmAction(new cloudwatch.SnsAction(this.alertTopic));

    // High latency alarm
    new cloudwatch.Alarm(this, 'ApiGatewayLatencyAlarm', {
      alarmName: `${api.restApiName}-high-latency`,
      alarmDescription: 'High latency for API Gateway',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: 'Latency',
        dimensionsMap: {
          ApiName: api.restApiName
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5)
      }),
      threshold: config.monitoring.alarmThresholds.latencyMs,
      evaluationPeriods: 3
    }).addAlarmAction(new cloudwatch.SnsAction(this.alertTopic));
  }

  private createBusinessMetricAlarms(config: GameBaseServiceConfig): void {
    // Low base creation activity alarm (indicates potential issues)
    new cloudwatch.Alarm(this, 'LowBaseActivityAlarm', {
      alarmName: 'low-base-creation-activity',
      alarmDescription: 'Unusually low base creation activity',
      metric: new cloudwatch.Metric({
        namespace: 'GameBaseService/Business',
        metricName: 'BaseCreated',
        statistic: 'Sum',
        period: cdk.Duration.hours(1)
      }),
      threshold: 1, // Less than 1 base created per hour
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING
    }).addAlarmAction(new cloudwatch.SnsAction(this.alertTopic));
  }

  private createCostMonitoring(environment: string, config: GameBaseServiceConfig): void {
    if (config.costs.enableCostAlerts) {
      // Create budget for cost monitoring
      new budgets.CfnBudget(this, 'ServiceBudget', {
        budget: {
          budgetName: `game-base-service-${environment}-budget`,
          budgetLimit: {
            amount: config.costs.monthlyBudgetUsd,
            unit: 'USD'
          },
          timeUnit: 'MONTHLY',
          budgetType: 'COST',
          costFilters: {
            Service: ['Amazon API Gateway', 'AWS Lambda', 'Amazon DynamoDB']
          }
        },
        notificationsWithSubscribers: [
          {
            notification: {
              notificationType: 'ACTUAL',
              comparisonOperator: 'GREATER_THAN',
              threshold: 80 // Alert at 80% of budget
            },
            subscribers: [
              {
                subscriptionType: 'SNS',
                address: this.alertTopic.topicArn
              }
            ]
          },
          {
            notification: {
              notificationType: 'FORECASTED',
              comparisonOperator: 'GREATER_THAN',
              threshold: 100 // Alert if forecasted to exceed budget
            },
            subscribers: [
              {
                subscriptionType: 'SNS',
                address: this.alertTopic.topicArn
              }
            ]
          }
        ]
      });
    }
  }
}