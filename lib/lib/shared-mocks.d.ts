/**
 * Temporary mock implementations for shared libraries
 * This allows testing and development when shared packages are not available
 */
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
export declare class StructuredLogger {
    private context;
    constructor(context: string);
    info(message: string, details?: any): void;
    warn(message: string, details?: any): void;
    error(message: string, details?: any): void;
    debug(message: string, details?: any): void;
}
export declare class GameEngineError extends Error {
    readonly code: string;
    readonly details?: any;
    constructor(message: string, code: string, details?: any);
}
export declare const withErrorHandling: <T>(handler: () => Promise<T>, logger?: StructuredLogger) => Promise<T>;
export declare const validateRequest: <T>(schema: any, body: string | null) => Promise<T>;
export declare const publishCustomMetric: (namespace: string, metricName: string, value: number, dimensions?: Record<string, string>) => Promise<void>;
export interface GameBaseServiceConfig {
    environment: string;
    region: string;
    costs: {
        enableCostAlerts: boolean;
        monthlyBudgetUsd: number;
    };
    monitoring: {
        alarmThresholds: {
            errorRate: number;
            latencyMs: number;
        };
    };
}
export declare const createConfigFromEnvironment: (environment?: string) => GameBaseServiceConfig;
export declare class MockLoggingConstruct extends Construct {
    readonly logGroup: logs.LogGroup;
    constructor(scope: Construct, id: string);
}
