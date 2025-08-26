/**
 * Temporary mock implementations for shared libraries
 * This allows testing and development when shared packages are not available
 */

import * as logs from 'aws-cdk-lib/aws-logs';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

// Mock StructuredLogger
export class StructuredLogger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  info(message: string, details?: Record<string, unknown>): void {
    console.log(`[INFO] ${this.context}: ${message}`, details ?? '');
  }

  warn(message: string, details?: Record<string, unknown>): void {
    console.warn(`[WARN] ${this.context}: ${message}`, details ?? '');
  }

  error(message: string, details?: Record<string, unknown>): void {
    console.error(`[ERROR] ${this.context}: ${message}`, details ?? '');
  }

  debug(message: string, details?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${this.context}: ${message}`, details ?? '');
    }
  }
}

// Mock GameEngineError
export class GameEngineError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'GameEngineError';
    this.code = code;
    this.details = details;
  }
}

// Mock withErrorHandling
export const withErrorHandling = async <T>(
  handler: () => Promise<T>,
  logger?: StructuredLogger
): Promise<T> => {
  try {
    return await handler();
  } catch (error) {
    logger?.error('Error in handler', { error: (error as Error).message });
    
    if (error instanceof GameEngineError) {
      throw error;
    }
    
    // Convert unknown errors to GameEngineError
    throw new GameEngineError(
      (error as Error).message || 'Internal server error',
      'INTERNAL_ERROR',
      { originalError: error }
    );
  }
};

// Mock validateRequest
export const validateRequest = async <T>(
  schema: { parse: (data: unknown) => T },
  body: string | null
): Promise<T> => {
  if (!body) {
    throw new GameEngineError('Request body is required', 'VALIDATION_ERROR');
  }

  try {
    const parsed = JSON.parse(body);
    return schema.parse(parsed);
  } catch (error) {
    throw new GameEngineError('Invalid request format', 'VALIDATION_ERROR', { error: (error as Error).message });
  }
};

// Mock publishCustomMetric
export const publishCustomMetric = async (
  namespace: string,
  metricName: string,
  value: number,
  dimensions?: Record<string, string>
): Promise<void> => {
  console.log(`[METRIC] ${namespace}/${metricName}: ${value}`, dimensions || '');
};

// Mock configuration types
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

// Mock createConfigFromEnvironment
export const createConfigFromEnvironment = (environment?: string): GameBaseServiceConfig => {
  const env = environment || process.env.ENVIRONMENT || 'development';
  
  return {
    environment: env,
    region: process.env.AWS_REGION || 'eu-north-1',
    costs: {
      enableCostAlerts: env === 'production',
      monthlyBudgetUsd: env === 'production' ? 1000 : env === 'qa' ? 200 : 100
    },
    monitoring: {
      alarmThresholds: {
        errorRate: env === 'production' ? 5 : 10,
        latencyMs: env === 'production' ? 1000 : 3000
      }
    }
  };
};

// Mock CDK constructs
export class MockLoggingConstruct extends Construct {
  public readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    this.logGroup = new logs.LogGroup(this, 'LogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });
  }
}