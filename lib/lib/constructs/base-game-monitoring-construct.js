"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseGameMonitoringConstruct = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const cloudwatchActions = __importStar(require("aws-cdk-lib/aws-cloudwatch-actions"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const budgets = __importStar(require("aws-cdk-lib/aws-budgets"));
const constructs_1 = require("constructs");
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
class BaseGameMonitoringConstruct extends constructs_1.Construct {
    dashboard;
    alertTopic;
    constructor(scope, id, props) {
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
    createAlertTopic(environment) {
        return new sns.Topic(this, 'AlertTopic', {
            topicName: `game-base-service-alerts-${environment}`,
            displayName: `Game Base Service Alerts (${environment})`,
            // TODO: Add email subscriptions based on environment
            // For now, alerts go to CloudWatch only
        });
    }
    createDashboard(environment, lambdas, api) {
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
        }));
        dashboard.addWidgets(
        // Second row: Lambda performance
        new cloudwatch.GraphWidget({
            title: 'Lambda Performance',
            width: 12,
            height: 6,
            left: lambdaMetrics.duration,
            right: lambdaMetrics.errors
        }), new cloudwatch.GraphWidget({
            title: 'Lambda Invocations',
            width: 12,
            height: 6,
            left: lambdaMetrics.invocations,
            right: lambdaMetrics.throttles
        }));
        dashboard.addWidgets(
        // Third row: Business metrics
        new cloudwatch.GraphWidget({
            title: 'Base Creation Activity',
            width: 12,
            height: 6,
            left: [businessMetrics.baseCreations]
        }), new cloudwatch.GraphWidget({
            title: 'Base Operations',
            width: 12,
            height: 6,
            left: [
                businessMetrics.baseUpgrades,
                businessMetrics.baseMoves
            ]
        }));
        return dashboard;
    }
    createApiGatewayWidgets(api) {
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
    createLambdaWidgets(lambdas) {
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
    createBusinessMetricWidgets(environment) {
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
    createLambdaAlarms(lambdas, config) {
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
            }).addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));
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
            }).addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));
        });
    }
    createApiGatewayAlarms(api, config) {
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
        }).addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));
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
        }).addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));
    }
    createBusinessMetricAlarms(config) {
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
        }).addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));
    }
    createCostMonitoring(environment, config) {
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
exports.BaseGameMonitoringConstruct = BaseGameMonitoringConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS1nYW1lLW1vbml0b3JpbmctY29uc3RydWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vY29uc3RydWN0cy9iYXNlLWdhbWUtbW9uaXRvcmluZy1jb25zdHJ1Y3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHVFQUF5RDtBQUN6RCxzRkFBd0U7QUFHeEUseURBQTJDO0FBQzNDLGlFQUFtRDtBQUNuRCwyQ0FBdUM7QUFXdkM7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQWtCRztBQUNILE1BQWEsMkJBQTRCLFNBQVEsc0JBQVM7SUFDeEMsU0FBUyxDQUF1QjtJQUNoQyxVQUFVLENBQVk7SUFFdEMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF1QztRQUMvRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLE1BQU0sRUFBRSxXQUFXLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxHQUFHLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFcEQsOEJBQThCO1FBQzlCLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRXJELDhCQUE4QjtRQUM5QixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsV0FBVyxFQUFFLE9BQU8sRUFBRSxHQUFHLENBQUMsQ0FBQztRQUVqRSxrQ0FBa0M7UUFDbEMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQztRQUV6Qyx1Q0FBdUM7UUFDdkMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUV6Qyx1Q0FBdUM7UUFDdkMsSUFBSSxDQUFDLDBCQUEwQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRXhDLHlCQUF5QjtRQUN6QixJQUFJLENBQUMs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QzlCLGtCQUFrQixFQUFFLGNBQWM7NEJBQ2xDLFNBQVMsRUFBRSxHQUFHLENBQUMsdUNBQXVDO3lCQUN2RDt3QkFDRCxXQUFXLEVBQUU7NEJBQ1g7Z0NBQ0UsZ0JBQWdCLEVBQUUsS0FBSztnQ0FDdkIsT0FBTyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUTs2QkFDbEM7eUJBQ0Y7cUJBQ0Y7aUJBQ0Y7YUFDRixDQUFDLENBQUM7UUFDTCxDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBaFlELGtFQWdZQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2hBY3Rpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoLWFjdGlvbnMnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBzbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucyc7XG5pbXBvcnQgKiBhcyBidWRnZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1idWRnZXRzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgTm9kZWpzRnVuY3Rpb24gfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhLW5vZGVqcyc7XG5pbXBvcnQgeyBHYW1lQmFzZVNlcnZpY2VDb25maWcgfSBmcm9tICcuLi9jb25maWcvZW52aXJvbm1lbnQtY29uZmlnJztcblxuZXhwb3J0IGludGVyZmFjZSBCYXNlR2FtZU1vbml0b3JpbmdDb25zdHJ1Y3RQcm9wcyB7XG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG4gIGNvbmZpZzogR2FtZUJhc2VTZXJ2aWNlQ29uZmlnO1xuICBsYW1iZGFzOiBOb2RlanNGdW5jdGlvbltdO1xuICBhcGk6IGFwaWdhdGV3YXkuUmVzdEFwaTtcbn1cblxuLyoqXG4gKiBCYXNlIEdhbWUgTW9uaXRvcmluZyBDb25zdHJ1Y3RcbiAqIFxuICogSW1wbGVtZW50cyBjb21wcmVoZW5zaXZlIG1vbml0b3JpbmcgZm9yIGJhc2Ugc2VydmljZSBmb2xsb3dpbmcgU09MSUQgcHJpbmNpcGxlczpcbiAqIC0gU2luZ2xlIFJlc3BvbnNpYmlsaXR5OiBPbmx5IGhhbmRsZXMgbW9uaXRvcmluZyBhbmQgYWxlcnRpbmdcbiAqIC0gT3Blbi9DbG9zZWQ6IEVhc3kgdG8gYWRkIG5ldyBtZXRyaWNzIHdpdGhvdXQgbW9kaWZ5aW5nIGV4aXN0aW5nIG9uZXNcbiAqIC0gTGlza292IFN1YnN0aXR1dGlvbjogQWxsIG1vbml0b3JpbmcgY29tcG9uZW50cyBmb2xsb3cgY29uc2lzdGVudCBwYXR0ZXJuc1xuICogLSBJbnRlcmZhY2UgU2VncmVnYXRpb246IFNlcGFyYXRlIG1vbml0b3JpbmcgZm9yIGRpZmZlcmVudCBjb25jZXJuc1xuICogLSBEZXBlbmRlbmN5IEludmVyc2lvbjogRGVwZW5kcyBvbiBDbG91ZFdhdGNoIGFic3RyYWN0aW9uc1xuICogXG4gKiBNb25pdG9yaW5nIEZlYXR1cmVzOlxuICogLSBMYW1iZGEgZnVuY3Rpb24gcGVyZm9ybWFuY2UgbWV0cmljc1xuICogLSBBUEkgR2F0ZXdheSBwZXJmb3JtYW5jZSBhbmQgZXJyb3IgdHJhY2tpbmdcbiAqIC0gRHluYW1vREIgcGVyZm9ybWFuY2UgbW9uaXRvcmluZ1xuICogLSBDdXN0b20gYnVzaW5lc3MgbWV0cmljcyAoYmFzZSBjcmVhdGlvbiByYXRlLCB1cGdyYWRlIHN1Y2Nlc3MsIGV0Yy4pXG4gKiAtIENvc3QgbW9uaXRvcmluZyBhbmQgYnVkZ2V0IGFsZXJ0c1xuICogLSBPcGVyYXRpb25hbCBkYXNoYm9hcmRzXG4gKiAtIEF1dG9tYXRlZCBhbGVydGluZyB2aWEgU05TXG4gKi9cbmV4cG9ydCBjbGFzcyBCYXNlR2FtZU1vbml0b3JpbmdDb25zdHJ1Y3QgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgZGFzaGJvYXJkOiBjbG91ZHdhdGNoLkRhc2hib2FyZDtcbiAgcHVibGljIHJlYWRvbmx5IGFsZXJ0VG9waWM6IHNucy5Ub3BpYztcbiAgXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBCYXNlR2FtZU1vbml0b3JpbmdDb25zdHJ1Y3RQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICBjb25zdCB7IGVudmlyb25tZW50LCBjb25maWcsIGxhbWJkYXMsIGFwaSB9ID0gcHJvcHM7XG5cbiAgICAvLyBDcmVhdGUgU05TIHRvcGljIGZvciBhbGVydHNcbiAgICB0aGlzLmFsZXJ0VG9waWMgPSB0aGlzLmNyZWF0ZUFsZXJ0VG9waWMoZW52aXJvbm1lbnQpO1xuXG4gICAgLy8gQ3JlYXRlIENsb3VkV2F0Y2ggZGFzaGJvYXJkXG4gICAgdGhpcy5kYXNoYm9hcmQgPSB0aGlzLmNyZWF0ZURhc2hib2FyZChlbnZpcm9ubWVudCwgbGFtYmRhcywgYXBpKTtcblxuICAgIC8vIENyZWF0ZSBMYW1iZGEgbW9uaXRvcmluZyBhbGFybXNcbiAgICB0aGlzLmNyZWF0ZUxhbWJkYUFsYXJtcyhsYW1iZGFzLCBjb25maWcpO1xuXG4gICAgLy8gQ3JlYXRlIEFQSSBHYXRld2F5IG1vbml0b3JpbmcgYWxhcm1zXG4gICAgdGhpcy5jcmVhdGVBcGlHYXRld2F5QWxhcm1zKGFwaSwgY29uZmlnKTtcblxuICAgIC8vIENyZWF0ZSBjdXN0b20gYnVzaW5lc3MgbWV0cmljIGFsYXJtc1xuICAgIHRoaXMuY3JlYXRlQnVzaW5lc3NNZXRyaWNBbGFybXMoY29uZmlnKTtcblxuICAgIC8vIENyZWF0ZSBjb3N0IG1vbml0b3JpbmdcbiAgICB0aGlzLmNyZWF0ZUNvc3RNb25pdG9yaW5nKGVudmlyb25tZW50LCBjb25maWcpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVBbGVydFRvcGljKGVudmlyb25tZW50OiBzdHJpbmcpOiBzbnMuVG9waWMge1xuICAgIHJldHVybiBuZXcgc25zLlRvcGljKHRoaXMsICdBbGVydFRvcGljJywge1xuICAgICAgdG9waWNOYW1lOiBgZ2FtZS1iYXNlLXNlcnZpY2UtYWxlcnRzLSR7ZW52aXJvbm1lbnR9YCxcbiAgICAgIGRpc3BsYXlOYW1lOiBgR2FtZSBCYXNlIFNlcnZpY2UgQWxlcnRzICgke2Vudmlyb25tZW50fSlgLFxuICAgICAgLy8gVE9ETzogQWRkIGVtYWlsIHN1YnNjcmlwdGlvbnMgYmFzZWQgb24gZW52aXJvbm1lbnRcbiAgICAgIC8vIEZvciBub3csIGFsZXJ0cyBnbyB0byBDbG91ZFdhdGNoIG9ubHlcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlRGFzaGJvYXJkKFxuICAgIGVudmlyb25tZW50OiBzdHJpbmcsXG4gICAgbGFtYmRhczogTm9kZWpzRnVuY3Rpb25bXSxcbiAgICBhcGk6IGFwaWdhdGV3YXkuUmVzdEFwaVxuICApOiBjbG91ZHdhdGNoLkRhc2hib2FyZCB7XG4gICAgY29uc3QgZGFzaGJvYXJkID0gbmV3IGNsb3Vkd2F0Y2guRGFzaGJvYXJkKHRoaXMsICdTZXJ2aWNlRGFzaGJvYXJkJywge1xuICAgICAgZGFzaGJvYXJkTmFtZTogYEdhbWVCYXNlU2VydmljZS0ke2Vudmlyb25tZW50fWAsXG4gICAgICBwZXJpb2RPdmVycmlkZTogY2xvdWR3YXRjaC5QZXJpb2RPdmVycmlkZS5BVVRPXG4gICAgfSk7XG5cbiAgICAvLyBBUEkgR2F0ZXdheSBtZXRyaWNzXG4gICAgY29uc3QgYXBpTWV0cmljcyA9IHRoaXMuY3JlYXRlQXBpR2F0ZXdheVdpZGdldHMoYXBpKTtcbiAgICBcbiAgICAvLyBMYW1iZGEgbWV0cmljc1xuICAgIGNvbnN0IGxhbWJkYU1ldHJpY3MgPSB0aGlzLmNyZWF0ZUxhbWJkYVdpZGdldHMobGFtYmRhcyk7XG4gICAgXG4gICAgLy8gQ3VzdG9tIGJ1c2luZXNzIG1ldHJpY3NcbiAgICBjb25zdCBidXNpbmVzc01ldHJpY3MgPSB0aGlzLmNyZWF0ZUJ1c2luZXNzTWV0cmljV2lkZ2V0cyhlbnZpcm9ubWVudCk7XG5cbiAgICAvLyBMYXlvdXQgZGFzaGJvYXJkXG4gICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICAvLyBGaXJzdCByb3c6IEFQSSBHYXRld2F5IG92ZXJ2aWV3XG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnQVBJIEdhdGV3YXkgT3ZlcnZpZXcnLFxuICAgICAgICB3aWR0aDogMjQsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIGFwaU1ldHJpY3MucmVxdWVzdENvdW50LFxuICAgICAgICAgIGFwaU1ldHJpY3Muc3VjY2Vzc1JhdGVcbiAgICAgICAgXSxcbiAgICAgICAgcmlnaHQ6IFtcbiAgICAgICAgICBhcGlNZXRyaWNzLmxhdGVuY3ksXG4gICAgICAgICAgYXBpTWV0cmljcy5lcnJvclJhdGVcbiAgICAgICAgXVxuICAgICAgfSlcbiAgICApO1xuXG4gICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICAvLyBTZWNvbmQgcm93OiBMYW1iZGEgcGVyZm9ybWFuY2VcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdMYW1iZGEgUGVyZm9ybWFuY2UnLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgICAgbGVmdDogbGFtYmRhTWV0cmljcy5kdXJhdGlvbixcbiAgICAgICAgcmlnaHQ6IGxhbWJkYU1ldHJpY3MuZXJyb3JzXG4gICAgICB9KSxcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdMYW1iZGEgSW52b2NhdGlvbnMnLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgICAgbGVmdDogbGFtYmRhTWV0cmljcy5pbnZvY2F0aW9ucyxcbiAgICAgICAgcmlnaHQ6IGxhbWJkYU1ldHJpY3MudGhyb3R0bGVzXG4gICAgICB9KVxuICAgICk7XG5cbiAgICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIC8vIFRoaXJkIHJvdzogQnVzaW5lc3MgbWV0cmljc1xuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ0Jhc2UgQ3JlYXRpb24gQWN0aXZpdHknLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgICAgbGVmdDogW2J1c2luZXNzTWV0cmljcy5iYXNlQ3JlYXRpb25zXVxuICAgICAgfSksXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnQmFzZSBPcGVyYXRpb25zJyxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBidXNpbmVzc01ldHJpY3MuYmFzZVVwZ3JhZGVzLFxuICAgICAgICAgIGJ1c2luZXNzTWV0cmljcy5iYXNlTW92ZXNcbiAgICAgICAgXVxuICAgICAgfSlcbiAgICApO1xuXG4gICAgcmV0dXJuIGRhc2hib2FyZDtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlQXBpR2F0ZXdheVdpZGdldHMoYXBpOiBhcGlnYXRld2F5LlJlc3RBcGkpIHtcbiAgICBjb25zdCBhcGlOYW1lID0gYXBpLnJlc3RBcGlOYW1lO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICByZXF1ZXN0Q291bnQ6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcGlHYXRld2F5JyxcbiAgICAgICAgbWV0cmljTmFtZTogJ0NvdW50JyxcbiAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgIEFwaU5hbWU6IGFwaU5hbWVcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KVxuICAgICAgfSksXG5cbiAgICAgIHN1Y2Nlc3NSYXRlOiBuZXcgY2xvdWR3YXRjaC5NYXRoRXhwcmVzc2lvbih7XG4gICAgICAgIGV4cHJlc3Npb246ICcxMDAgLSAoNFhYICsgNVhYKSAvIENvdW50ICogMTAwJyxcbiAgICAgICAgdXNpbmdNZXRyaWNzOiB7XG4gICAgICAgICAgJ0NvdW50JzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcGlHYXRld2F5JyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdDb3VudCcsXG4gICAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7IEFwaU5hbWU6IGFwaU5hbWUgfVxuICAgICAgICAgIH0pLFxuICAgICAgICAgICc0WFgnOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0FwaUdhdGV3YXknLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJzRYWEVycm9yJyxcbiAgICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHsgQXBpTmFtZTogYXBpTmFtZSB9XG4gICAgICAgICAgfSksXG4gICAgICAgICAgJzVYWCc6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQXBpR2F0ZXdheScsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnNVhYRXJyb3InLFxuICAgICAgICAgICAgZGltZW5zaW9uc01hcDogeyBBcGlOYW1lOiBhcGlOYW1lIH1cbiAgICAgICAgICB9KVxuICAgICAgICB9LFxuICAgICAgICBsYWJlbDogJ1N1Y2Nlc3MgUmF0ZSAoJSknXG4gICAgICB9KSxcblxuICAgICAgbGF0ZW5jeTogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0FwaUdhdGV3YXknLFxuICAgICAgICBtZXRyaWNOYW1lOiAnTGF0ZW5jeScsXG4gICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICBBcGlOYW1lOiBhcGlOYW1lXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnXG4gICAgICB9KSxcblxuICAgICAgZXJyb3JSYXRlOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQXBpR2F0ZXdheScsXG4gICAgICAgIG1ldHJpY05hbWU6ICc1WFhFcnJvcicsXG4gICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICBBcGlOYW1lOiBhcGlOYW1lXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ1N1bSdcbiAgICAgIH0pXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlTGFtYmRhV2lkZ2V0cyhsYW1iZGFzOiBOb2RlanNGdW5jdGlvbltdKSB7XG4gICAgY29uc3QgbGFtYmRhTWV0cmljcyA9IGxhbWJkYXMubWFwKGxhbWJkYSA9PiAoe1xuICAgICAgZHVyYXRpb246IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9MYW1iZGEnLFxuICAgICAgICBtZXRyaWNOYW1lOiAnRHVyYXRpb24nLFxuICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgRnVuY3Rpb25OYW1lOiBsYW1iZGEuZnVuY3Rpb25OYW1lXG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICAgZXJyb3JzOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvTGFtYmRhJyxcbiAgICAgICAgbWV0cmljTmFtZTogJ0Vycm9ycycsXG4gICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICBGdW5jdGlvbk5hbWU6IGxhbWJkYS5mdW5jdGlvbk5hbWVcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgICBpbnZvY2F0aW9uczogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0xhbWJkYScsXG4gICAgICAgIG1ldHJpY05hbWU6ICdJbnZvY2F0aW9ucycsXG4gICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICBGdW5jdGlvbk5hbWU6IGxhbWJkYS5mdW5jdGlvbk5hbWVcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgICB0aHJvdHRsZXM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9MYW1iZGEnLFxuICAgICAgICBtZXRyaWNOYW1lOiAnVGhyb3R0bGVzJyxcbiAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgIEZ1bmN0aW9uTmFtZTogbGFtYmRhLmZ1bmN0aW9uTmFtZVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH0pKTtcblxuICAgIHJldHVybiB7XG4gICAgICBkdXJhdGlvbjogbGFtYmRhTWV0cmljcy5tYXAobSA9PiBtLmR1cmF0aW9uKSxcbiAgICAgIGVycm9yczogbGFtYmRhTWV0cmljcy5tYXAobSA9PiBtLmVycm9ycyksXG4gICAgICBpbnZvY2F0aW9uczogbGFtYmRhTWV0cmljcy5tYXAobSA9PiBtLmludm9jYXRpb25zKSxcbiAgICAgIHRocm90dGxlczogbGFtYmRhTWV0cmljcy5tYXAobSA9PiBtLnRocm90dGxlcylcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVCdXNpbmVzc01ldHJpY1dpZGdldHMoZW52aXJvbm1lbnQ6IHN0cmluZykge1xuICAgIHJldHVybiB7XG4gICAgICBiYXNlQ3JlYXRpb25zOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdHYW1lQmFzZVNlcnZpY2UvQnVzaW5lc3MnLFxuICAgICAgICBtZXRyaWNOYW1lOiAnQmFzZUNyZWF0ZWQnLFxuICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgRW52aXJvbm1lbnQ6IGVudmlyb25tZW50XG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ1N1bSdcbiAgICAgIH0pLFxuXG4gICAgICBiYXNlVXBncmFkZXM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0dhbWVCYXNlU2VydmljZS9CdXNpbmVzcycsXG4gICAgICAgIG1ldHJpY05hbWU6ICdCYXNlVXBncmFkZWQnLFxuICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgRW52aXJvbm1lbnQ6IGVudmlyb25tZW50XG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ1N1bSdcbiAgICAgIH0pLFxuXG4gICAgICBiYXNlTW92ZXM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0dhbWVCYXNlU2VydmljZS9CdXNpbmVzcycsXG4gICAgICAgIG1ldHJpY05hbWU6ICdCYXNlTW92ZWQnLFxuICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgRW52aXJvbm1lbnQ6IGVudmlyb25tZW50XG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ1N1bSdcbiAgICAgIH0pXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlTGFtYmRhQWxhcm1zKGxhbWJkYXM6IE5vZGVqc0Z1bmN0aW9uW10sIGNvbmZpZzogR2FtZUJhc2VTZXJ2aWNlQ29uZmlnKTogdm9pZCB7XG4gICAgbGFtYmRhcy5mb3JFYWNoKChsYW1iZGFGdW5jdGlvbiwgaW5kZXgpID0+IHtcbiAgICAgIGNvbnN0IGZ1bmN0aW9uTmFtZSA9IGxhbWJkYUZ1bmN0aW9uLmZ1bmN0aW9uTmFtZTtcbiAgICAgIFxuICAgICAgLy8gRXJyb3IgcmF0ZSBhbGFybVxuICAgICAgbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgYExhbWJkYUVycm9yQWxhcm0ke2luZGV4fWAsIHtcbiAgICAgICAgYWxhcm1OYW1lOiBgJHtmdW5jdGlvbk5hbWV9LWVycm9yLXJhdGVgLFxuICAgICAgICBhbGFybURlc2NyaXB0aW9uOiBgSGlnaCBlcnJvciByYXRlIGZvciAke2Z1bmN0aW9uTmFtZX1gLFxuICAgICAgICBtZXRyaWM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0xhbWJkYScsXG4gICAgICAgICAgbWV0cmljTmFtZTogJ0Vycm9ycycsXG4gICAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiBmdW5jdGlvbk5hbWVcbiAgICAgICAgICB9LFxuICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KVxuICAgICAgICB9KSxcbiAgICAgICAgdGhyZXNob2xkOiBjb25maWcubW9uaXRvcmluZy5hbGFybVRocmVzaG9sZHMuZXJyb3JSYXRlLFxuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkdcbiAgICAgIH0pLmFkZEFsYXJtQWN0aW9uKG5ldyBjbG91ZHdhdGNoQWN0aW9ucy5TbnNBY3Rpb24odGhpcy5hbGVydFRvcGljKSk7XG5cbiAgICAgIC8vIER1cmF0aW9uIGFsYXJtXG4gICAgICBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCBgTGFtYmRhRHVyYXRpb25BbGFybSR7aW5kZXh9YCwge1xuICAgICAgICBhbGFybU5hbWU6IGAke2Z1bmN0aW9uTmFtZX0taGlnaC1kdXJhdGlvbmAsXG4gICAgICAgIGFsYXJtRGVzY3JpcHRpb246IGBIaWdoIGR1cmF0aW9uIGZvciAke2Z1bmN0aW9uTmFtZX1gLFxuICAgICAgICBtZXRyaWM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0xhbWJkYScsXG4gICAgICAgICAgbWV0cmljTmFtZTogJ0R1cmF0aW9uJyxcbiAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgICBGdW5jdGlvbk5hbWU6IGZ1bmN0aW9uTmFtZVxuICAgICAgICAgIH0sXG4gICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KVxuICAgICAgICB9KSxcbiAgICAgICAgdGhyZXNob2xkOiBjb25maWcubW9uaXRvcmluZy5hbGFybVRocmVzaG9sZHMubGF0ZW5jeU1zLFxuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMyxcbiAgICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkdcbiAgICAgIH0pLmFkZEFsYXJtQWN0aW9uKG5ldyBjbG91ZHdhdGNoQWN0aW9ucy5TbnNBY3Rpb24odGhpcy5hbGVydFRvcGljKSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUFwaUdhdGV3YXlBbGFybXMoYXBpOiBhcGlnYXRld2F5LlJlc3RBcGksIGNvbmZpZzogR2FtZUJhc2VTZXJ2aWNlQ29uZmlnKTogdm9pZCB7XG4gICAgLy8gNVhYIEVycm9yIGFsYXJtXG4gICAgbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ0FwaUdhdGV3YXk1WFhBbGFybScsIHtcbiAgICAgIGFsYXJtTmFtZTogYCR7YXBpLnJlc3RBcGlOYW1lfS01eHgtZXJyb3JzYCxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdIaWdoIDVYWCBlcnJvciByYXRlIGZvciBBUEkgR2F0ZXdheScsXG4gICAgICBtZXRyaWM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcGlHYXRld2F5JyxcbiAgICAgICAgbWV0cmljTmFtZTogJzVYWEVycm9yJyxcbiAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgIEFwaU5hbWU6IGFwaS5yZXN0QXBpTmFtZVxuICAgICAgICB9LFxuICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpXG4gICAgICB9KSxcbiAgICAgIHRocmVzaG9sZDogNSwgLy8gNSBlcnJvcnMgaW4gNSBtaW51dGVzXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMlxuICAgIH0pLmFkZEFsYXJtQWN0aW9uKG5ldyBjbG91ZHdhdGNoQWN0aW9ucy5TbnNBY3Rpb24odGhpcy5hbGVydFRvcGljKSk7XG5cbiAgICAvLyBIaWdoIGxhdGVuY3kgYWxhcm1cbiAgICBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnQXBpR2F0ZXdheUxhdGVuY3lBbGFybScsIHtcbiAgICAgIGFsYXJtTmFtZTogYCR7YXBpLnJlc3RBcGlOYW1lfS1oaWdoLWxhdGVuY3lgLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ0hpZ2ggbGF0ZW5jeSBmb3IgQVBJIEdhdGV3YXknLFxuICAgICAgbWV0cmljOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQXBpR2F0ZXdheScsXG4gICAgICAgIG1ldHJpY05hbWU6ICdMYXRlbmN5JyxcbiAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgIEFwaU5hbWU6IGFwaS5yZXN0QXBpTmFtZVxuICAgICAgICB9LFxuICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KVxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IGNvbmZpZy5tb25pdG9yaW5nLmFsYXJtVGhyZXNob2xkcy5sYXRlbmN5TXMsXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogM1xuICAgIH0pLmFkZEFsYXJtQWN0aW9uKG5ldyBjbG91ZHdhdGNoQWN0aW9ucy5TbnNBY3Rpb24odGhpcy5hbGVydFRvcGljKSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUJ1c2luZXNzTWV0cmljQWxhcm1zKGNvbmZpZzogR2FtZUJhc2VTZXJ2aWNlQ29uZmlnKTogdm9pZCB7XG4gICAgLy8gTG93IGJhc2UgY3JlYXRpb24gYWN0aXZpdHkgYWxhcm0gKGluZGljYXRlcyBwb3RlbnRpYWwgaXNzdWVzKVxuICAgIG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdMb3dCYXNlQWN0aXZpdHlBbGFybScsIHtcbiAgICAgIGFsYXJtTmFtZTogJ2xvdy1iYXNlLWNyZWF0aW9uLWFjdGl2aXR5JyxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdVbnVzdWFsbHkgbG93IGJhc2UgY3JlYXRpb24gYWN0aXZpdHknLFxuICAgICAgbWV0cmljOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdHYW1lQmFzZVNlcnZpY2UvQnVzaW5lc3MnLFxuICAgICAgICBtZXRyaWNOYW1lOiAnQmFzZUNyZWF0ZWQnLFxuICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5ob3VycygxKVxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IDEsIC8vIExlc3MgdGhhbiAxIGJhc2UgY3JlYXRlZCBwZXIgaG91clxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkxFU1NfVEhBTl9USFJFU0hPTEQsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuQlJFQUNISU5HXG4gICAgfSkuYWRkQWxhcm1BY3Rpb24obmV3IGNsb3Vkd2F0Y2hBY3Rpb25zLlNuc0FjdGlvbih0aGlzLmFsZXJ0VG9waWMpKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlQ29zdE1vbml0b3JpbmcoZW52aXJvbm1lbnQ6IHN0cmluZywgY29uZmlnOiBHYW1lQmFzZVNlcnZpY2VDb25maWcpOiB2b2lkIHtcbiAgICBpZiAoY29uZmlnLmNvc3RzLmVuYWJsZUNvc3RBbGVydHMpIHtcbiAgICAgIC8vIENyZWF0ZSBidWRnZXQgZm9yIGNvc3QgbW9uaXRvcmluZ1xuICAgICAgbmV3IGJ1ZGdldHMuQ2ZuQnVkZ2V0KHRoaXMsICdTZXJ2aWNlQnVkZ2V0Jywge1xuICAgICAgICBidWRnZXQ6IHtcbiAgICAgICAgICBidWRnZXROYW1lOiBgZ2FtZS1iYXNlLXNlcnZpY2UtJHtlbnZpcm9ubWVudH0tYnVkZ2V0YCxcbiAgICAgICAgICBidWRnZXRMaW1pdDoge1xuICAgICAgICAgICAgYW1vdW50OiBjb25maWcuY29zdHMubW9udGhseUJ1ZGdldFVzZCxcbiAgICAgICAgICAgIHVuaXQ6ICdVU0QnXG4gICAgICAgICAgfSxcbiAgICAgICAgICB0aW1lVW5pdDogJ01PTlRITFknLFxuICAgICAgICAgIGJ1ZGdldFR5cGU6ICdDT1NUJyxcbiAgICAgICAgICBjb3N0RmlsdGVyczoge1xuICAgICAgICAgICAgU2VydmljZTogWydBbWF6b24gQVBJIEdhdGV3YXknLCAnQVdTIExhbWJkYScsICdBbWF6b24gRHluYW1vREInXVxuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgbm90aWZpY2F0aW9uc1dpdGhTdWJzY3JpYmVyczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIG5vdGlmaWNhdGlvbjoge1xuICAgICAgICAgICAgICBub3RpZmljYXRpb25UeXBlOiAnQUNUVUFMJyxcbiAgICAgICAgICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiAnR1JFQVRFUl9USEFOJyxcbiAgICAgICAgICAgICAgdGhyZXNob2xkOiA4MCAvLyBBbGVydCBhdCA4MCUgb2YgYnVkZ2V0XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3Vic2NyaWJlcnM6IFtcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHN1YnNjcmlwdGlvblR5cGU6ICdTTlMnLFxuICAgICAgICAgICAgICAgIGFkZHJlc3M6IHRoaXMuYWxlcnRUb3BpYy50b3BpY0FyblxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBub3RpZmljYXRpb246IHtcbiAgICAgICAgICAgICAgbm90aWZpY2F0aW9uVHlwZTogJ0ZPUkVDQVNURUQnLFxuICAgICAgICAgICAgICBjb21wYXJpc29uT3BlcmF0b3I6ICdHUkVBVEVSX1RIQU4nLFxuICAgICAgICAgICAgICB0aHJlc2hvbGQ6IDEwMCAvLyBBbGVydCBpZiBmb3JlY2FzdGVkIHRvIGV4Y2VlZCBidWRnZXRcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzdWJzY3JpYmVyczogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgc3Vic2NyaXB0aW9uVHlwZTogJ1NOUycsXG4gICAgICAgICAgICAgICAgYWRkcmVzczogdGhpcy5hbGVydFRvcGljLnRvcGljQXJuXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgICB9XG4gICAgICAgIF1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufSJdfQ==