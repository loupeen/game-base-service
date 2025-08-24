/**
 * Environment-specific configuration for Game Base Service
 * Following shared-config-library patterns with gaming optimizations
 */
export interface GameBaseServiceConfig {
    environment: string;
    region: string;
    account: string;
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
    lambda: {
        memorySize: number;
        timeout: number;
        architecture: 'ARM_64' | 'X86_64';
        runtime: string;
    };
    dynamodb: {
        billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';
        pointInTimeRecovery: boolean;
        deletionProtection: boolean;
    };
    monitoring: {
        enableXRayTracing: boolean;
        logRetentionDays: number;
        alarmThresholds: {
            errorRate: number;
            latencyMs: number;
        };
    };
    costs: {
        monthlyBudgetUsd: number;
        enableCostAlerts: boolean;
    };
}
export declare function getGameBaseServiceConfig(environment: string): GameBaseServiceConfig;
