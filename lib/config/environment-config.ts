/**
 * Environment-specific configuration for Game Base Service
 * Following shared-config-library patterns with gaming optimizations
 */

export interface GameBaseServiceConfig {
  environment: string;
  region: string;
  account: string;
  
  // Base service specific configuration
  bases: {
    maxBasesPerPlayer: {
      free: number;
      subscription: number;
    };
    baseMovement: {
      cooldownMinutes: number;
      teleportCostGold: number;
    };
    spawning: {
      newPlayerGroupSize: number;
      spawnRadiusKm: number;
    };
  };
  
  // Performance and cost optimization
  lambda: {
    memorySize: number;
    timeout: number;
    architecture: 'ARM_64' | 'X86_64';
    runtime: string;
  };
  
  // DynamoDB configuration
  dynamodb: {
    billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';
    pointInTimeRecovery: boolean;
    deletionProtection: boolean;
  };
  
  // Monitoring and observability
  monitoring: {
    enableXRayTracing: boolean;
    logRetentionDays: number;
    alarmThresholds: {
      errorRate: number;
      latencyMs: number;
    };
  };
  
  // Cost controls
  costs: {
    monthlyBudgetUsd: number;
    enableCostAlerts: boolean;
  };
}

export function getGameBaseServiceConfig(environment: string): GameBaseServiceConfig {
  const baseConfig: GameBaseServiceConfig = {
    environment,
    region: getRegionForEnvironment(environment),
    account: getAccountForEnvironment(environment),
    
    bases: {
      maxBasesPerPlayer: {
        free: 5,
        subscription: 10
      },
      baseMovement: {
        cooldownMinutes: environment === 'test' ? 1 : 60, // Fast testing
        teleportCostGold: 100
      },
      spawning: {
        newPlayerGroupSize: 50,
        spawnRadiusKm: 10
      }
    },
    
    lambda: {
      memorySize: environment === 'production' ? 1024 : 512,
      timeout: 30,
      architecture: 'X86_64', // ARM64 causing Docker platform issues in CI
      runtime: 'nodejs18.x'
    },
    
    dynamodb: {
      billingMode: environment === 'production' ? 'PAY_PER_REQUEST' : 'PAY_PER_REQUEST',
      pointInTimeRecovery: environment === 'production',
      deletionProtection: environment === 'production'
    },
    
    monitoring: {
      enableXRayTracing: environment !== 'test',
      logRetentionDays: environment === 'production' ? 30 : 7,
      alarmThresholds: {
        errorRate: environment === 'production' ? 0.01 : 0.05, // 1% vs 5%
        latencyMs: environment === 'production' ? 1000 : 3000
      }
    },
    
    costs: {
      monthlyBudgetUsd: getBudgetForEnvironment(environment),
      enableCostAlerts: environment === 'production' // Only enable in production for now
    }
  };
  
  return baseConfig;
}

function getRegionForEnvironment(environment: string): string {
  switch (environment) {
    case 'test':
      return 'eu-north-1'; // Cost-optimized region
    case 'qa':
      return 'us-east-1'; // Production-like region
    case 'production':
      return 'us-east-1'; // Primary production region
    default:
      throw new Error(`Unknown environment: ${environment}`);
  }
}

function getAccountForEnvironment(environment: string): string {
  switch (environment) {
    case 'test':
      return '728427470046'; // GameTest account
    case 'qa':
      return '077029784291'; // GameQA account
    case 'production':
      return 'TBD'; // Production account (to be created)
    default:
      throw new Error(`Unknown environment: ${environment}`);
  }
}

function getBudgetForEnvironment(environment: string): number {
  switch (environment) {
    case 'test':
      return 50; // $50/month budget
    case 'qa':
      return 150; // $150/month budget
    case 'production':
      return 1000; // $1000/month budget
    default:
      return 50;
  }
}