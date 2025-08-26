"use strict";
/**
 * Environment-specific configuration for Game Base Service
 * Following shared-config-library patterns with gaming optimizations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGameBaseServiceConfig = getGameBaseServiceConfig;
function getGameBaseServiceConfig(environment) {
    const baseConfig = {
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
function getRegionForEnvironment(environment) {
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
function getAccountForEnvironment(environment) {
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
function getBudgetForEnvironment(environment) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW52aXJvbm1lbnQtY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vY29uZmlnL2Vudmlyb25tZW50LWNvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOztBQXVESCw0REFrREM7QUFsREQsU0FBZ0Isd0JBQXdCLENBQUMsV0FBbUI7SUFDMUQsTUFBTSxVQUFVLEdBQTBCO1FBQ3hDLFdBQVc7UUFDWCxNQUFNLEVBQUUsdUJBQXVCLENBQUMsV0FBVyxDQUFDO1FBQzVDLE9BQU8sRUFBRSx3QkFBd0IsQ0FBQyxXQUFXLENBQUM7UUFFOUMsS0FBSyxFQUFFO1lBQ0wsaUJBQWlCLEVBQUU7Z0JBQ2pCLElBQUksRUFBRSxDQUFDO2dCQUNQLFlBQVksRUFBRSxFQUFFO2FBQ2pCO1lBQ0QsWUFBWSxFQUFFO2dCQUNaLGVBQWUsRUFBRSxXQUFXLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxlQUFlO2dCQUNqRSxnQkFBZ0IsRUFBRSxHQUFHO2FBQ3RCO1lBQ0QsUUFBUSxFQUFFO2dCQUNSLGtCQUFrQixFQUFFLEVBQUU7Z0JBQ3RCLGFBQWEsRUFBRSxFQUFFO2FBQ2xCO1NBQ0Y7UUFFRCxNQUFNLEVBQUU7WUFDTixVQUFVLEVBQUUsV0FBVyxLQUFLLFlBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHO1lBQ3JELE9BQU8sRUFBRSxFQUFFO1lBQ1gsWUFBWSxFQUFFLFFBQVEsRUFBRSw2Q0FBNkM7WUFDckUsT0FBTyxFQUFFLFlBQVk7U0FDdEI7UUFFRCxRQUFRLEVBQUU7WUFDUixXQUFXLEVBQUUsV0FBVyxLQUFLLFlBQVksQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLGlCQUFpQjtZQUNqRixtQkFBbUIsRUFBRSxXQUFXLEtBQUssWUFBWTtZQUNqRCxrQkFBa0IsRUFBRSxXQUFXLEtBQUssWUFBWTtTQUNqRDtRQUVELFVBQVUsRUFBRTtZQUNWLGlCQUFpQixFQUFFLFdBQVcsS0FBSyxNQUFNO1lBQ3pDLGdCQUFnQixFQUFFLFdBQVcsS0FBSyxZQUFZLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN2RCxlQUFlLEVBQUU7Z0JBQ2YsU0FBUyxFQUFFLFdBQVcsS0FBSyxZQUFZLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLFdBQVc7Z0JBQ2xFLFNBQVMsRUFBRSxXQUFXLEtBQUssWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUk7YUFDdEQ7U0FDRjtRQUVELEtBQUssRUFBRTtZQUNMLGdCQUFnQixFQUFFLHVCQUF1QixDQUFDLFdBQVcsQ0FBQztZQUN0RCxnQkFBZ0IsRUFBRSxXQUFXLEtBQUssWUFBWSxDQUFDLG9DQUFvQztTQUNwRjtLQUNGLENBQUM7SUFFRixPQUFPLFVBQVUsQ0FBQztBQUNwQixDQUFDO0FBRUQsU0FBUyx1QkFBdUIsQ0FBQyxXQUFtQjtJQUNsRCxRQUFRLFdBQVcsRUFBRSxDQUFDO1FBQ3BCLEtBQUssTUFBTTtZQUNULE9BQU8sWUFBWSxDQUFDLENBQUMsd0JBQXdCO1FBQy9DLEtBQUssSUFBSTtZQUNQLE9BQU8sV0FBVyxDQUFDLENBQUMseUJBQXlCO1FBQy9DLEtBQUssWUFBWTtZQUNmLE9BQU8sV0FBVyxDQUFDLENBQUMsNEJBQTRCO1FBQ2xEO1lBQ0UsTUFBTSxJQUFJLEtBQUssQ0FBQyx3QkFBd0IsV0FBVyxFQUFFLENBQUMsQ0FBQztJQUMzRCxDQUFDO0FBQ0gsQ0FBQztBQUVELFNBQVMsd0JBQXdCLENBQUMsV0FBbUI7SUFDbkQsUUFBUSxXQUFXLEVBQUUsQ0FBQztRQUNwQixLQUFLLE1BQU07WUFDVCxPQUFPLGNBQWMsQ0FBQyxDQUFDLG1CQUFtQjtRQUM1QyxLQUFLLElBQUk7WUFDUCxPQUFPLGNBQWMsQ0FBQyxDQUFDLGlCQUFpQjtRQUMxQyxLQUFLLFlBQVk7WUFDZixPQUFPLEtBQUssQ0FBQyxDQUFDLHFDQUFxQztRQUNyRDtZQUNFLE1BQU0sSUFBSSxLQUFLLENBQUMsd0JBQXdCLFdBQVcsRUFBRSxDQUFDLENBQUM7SUFDM0QsQ0FBQztBQUNILENBQUM7QUFFRCxTQUFTLHVCQUF1QixDQUFDLFdBQW1CO0lBQ2xELFFBQVEsV0FBVyxFQUFFLENBQUM7UUFDcEIsS0FBSyxNQUFNO1lBQ1QsT0FBTyxFQUFFLENBQUMsQ0FBQyxtQkFBbUI7UUFDaEMsS0FBSyxJQUFJO1lBQ1AsT0FBTyxHQUFHLENBQUMsQ0FBQyxvQkFBb0I7UUFDbEMsS0FBSyxZQUFZO1lBQ2YsT0FBTyxJQUFJLENBQUMsQ0FBQyxxQkFBcUI7UUFDcEM7WUFDRSxPQUFPLEVBQUUsQ0FBQztJQUNkLENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBFbnZpcm9ubWVudC1zcGVjaWZpYyBjb25maWd1cmF0aW9uIGZvciBHYW1lIEJhc2UgU2VydmljZVxuICogRm9sbG93aW5nIHNoYXJlZC1jb25maWctbGlicmFyeSBwYXR0ZXJucyB3aXRoIGdhbWluZyBvcHRpbWl6YXRpb25zXG4gKi9cblxuZXhwb3J0IGludGVyZmFjZSBHYW1lQmFzZVNlcnZpY2VDb25maWcge1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xuICByZWdpb246IHN0cmluZztcbiAgYWNjb3VudDogc3RyaW5nO1xuICBcbiAgLy8gQmFzZSBzZXJ2aWNlIHNwZWNpZmljIGNvbmZpZ3VyYXRpb25cbiAgYmFzZXM6IHtcbiAgICBtYXhCYXNlc1BlclBsYXllcjoge1xuICAgICAgZnJlZTogbnVtYmVyO1xuICAgICAgc3Vic2NyaXB0aW9uOiBudW1iZXI7XG4gICAgfTtcbiAgICBiYXNlTW92ZW1lbnQ6IHtcbiAgICAgIGNvb2xkb3duTWludXRlczogbnVtYmVyO1xuICAgICAgdGVsZXBvcnRDb3N0R29sZDogbnVtYmVyO1xuICAgIH07XG4gICAgc3Bhd25pbmc6IHtcbiAgICAgIG5ld1BsYXllckdyb3VwU2l6ZTogbnVtYmVyO1xuICAgICAgc3Bhd25SYWRpdXNLbTogbnVtYmVyO1xuICAgIH07XG4gIH07XG4gIFxuICAvLyBQZXJmb3JtYW5jZSBhbmQgY29zdCBvcHRpbWl6YXRpb25cbiAgbGFtYmRhOiB7XG4gICAgbWVtb3J5U2l6ZTogbnVtYmVyO1xuICAgIHRpbWVvdXQ6IG51bWJlcjtcbiAgICBhcmNoaXRlY3R1cmU6ICdBUk1fNjQnIHwgJ1g4Nl82NCc7XG4gICAgcnVudGltZTogc3RyaW5nO1xuICB9O1xuICBcbiAgLy8gRHluYW1vREIgY29uZmlndXJhdGlvblxuICBkeW5hbW9kYjoge1xuICAgIGJpbGxpbmdNb2RlOiAnUEFZX1BFUl9SRVFVRVNUJyB8ICdQUk9WSVNJT05FRCc7XG4gICAgcG9pbnRJblRpbWVSZWNvdmVyeTogYm9vbGVhbjtcbiAgICBkZWxldGlvblByb3RlY3Rpb246IGJvb2xlYW47XG4gIH07XG4gIFxuICAvLyBNb25pdG9yaW5nIGFuZCBvYnNlcnZhYmlsaXR5XG4gIG1vbml0b3Jpbmc6IHtcbiAgICBlbmFibGVYUmF5VHJhY2luZzogYm9vbGVhbjtcbiAgICBsb2dSZXRlbnRpb25EYXlzOiBudW1iZXI7XG4gICAgYWxhcm1UaHJlc2hvbGRzOiB7XG4gICAgICBlcnJvclJhdGU6IG51bWJlcjtcbiAgICAgIGxhdGVuY3lNczogbnVtYmVyO1xuICAgIH07XG4gIH07XG4gIFxuICAvLyBDb3N0IGNvbnRyb2xzXG4gIGNvc3RzOiB7XG4gICAgbW9udGhseUJ1ZGdldFVzZDogbnVtYmVyO1xuICAgIGVuYWJsZUNvc3RBbGVydHM6IGJvb2xlYW47XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRHYW1lQmFzZVNlcnZpY2VDb25maWcoZW52aXJvbm1lbnQ6IHN0cmluZyk6IEdhbWVCYXNlU2VydmljZUNvbmZpZyB7XG4gIGNvbnN0IGJhc2VDb25maWc6IEdhbWVCYXNlU2VydmljZUNvbmZpZyA9IHtcbiAgICBlbnZpcm9ubWVudCxcbiAgICByZWdpb246IGdldFJlZ2lvbkZvckVudmlyb25tZW50KGVudmlyb25tZW50KSxcbiAgICBhY2NvdW50OiBnZXRBY2NvdW50Rm9yRW52aXJvbm1lbnQoZW52aXJvbm1lbnQpLFxuICAgIFxuICAgIGJhc2VzOiB7XG4gICAgICBtYXhCYXNlc1BlclBsYXllcjoge1xuICAgICAgICBmcmVlOiA1LFxuICAgICAgICBzdWJzY3JpcHRpb246IDEwXG4gICAgICB9LFxuICAgICAgYmFzZU1vdmVtZW50OiB7XG4gICAgICAgIGNvb2xkb3duTWludXRlczogZW52aXJvbm1lbnQgPT09ICd0ZXN0JyA/IDEgOiA2MCwgLy8gRmFzdCB0ZXN0aW5nXG4gICAgICAgIHRlbGVwb3J0Q29zdEdvbGQ6IDEwMFxuICAgICAgfSxcbiAgICAgIHNwYXduaW5nOiB7XG4gICAgICAgIG5ld1BsYXllckdyb3VwU2l6ZTogNTAsXG4gICAgICAgIHNwYXduUmFkaXVzS206IDEwXG4gICAgICB9XG4gICAgfSxcbiAgICBcbiAgICBsYW1iZGE6IHtcbiAgICAgIG1lbW9yeVNpemU6IGVudmlyb25tZW50ID09PSAncHJvZHVjdGlvbicgPyAxMDI0IDogNTEyLFxuICAgICAgdGltZW91dDogMzAsXG4gICAgICBhcmNoaXRlY3R1cmU6ICdYODZfNjQnLCAvLyBBUk02NCBjYXVzaW5nIERvY2tlciBwbGF0Zm9ybSBpc3N1ZXMgaW4gQ0lcbiAgICAgIHJ1bnRpbWU6ICdub2RlanMxOC54J1xuICAgIH0sXG4gICAgXG4gICAgZHluYW1vZGI6IHtcbiAgICAgIGJpbGxpbmdNb2RlOiBlbnZpcm9ubWVudCA9PT0gJ3Byb2R1Y3Rpb24nID8gJ1BBWV9QRVJfUkVRVUVTVCcgOiAnUEFZX1BFUl9SRVFVRVNUJyxcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IGVudmlyb25tZW50ID09PSAncHJvZHVjdGlvbicsXG4gICAgICBkZWxldGlvblByb3RlY3Rpb246IGVudmlyb25tZW50ID09PSAncHJvZHVjdGlvbidcbiAgICB9LFxuICAgIFxuICAgIG1vbml0b3Jpbmc6IHtcbiAgICAgIGVuYWJsZVhSYXlUcmFjaW5nOiBlbnZpcm9ubWVudCAhPT0gJ3Rlc3QnLFxuICAgICAgbG9nUmV0ZW50aW9uRGF5czogZW52aXJvbm1lbnQgPT09ICdwcm9kdWN0aW9uJyA/IDMwIDogNyxcbiAgICAgIGFsYXJtVGhyZXNob2xkczoge1xuICAgICAgICBlcnJvclJhdGU6IGVudmlyb25tZW50ID09PSAncHJvZHVjdGlvbicgPyAwLjAxIDogMC4wNSwgLy8gMSUgdnMgNSVcbiAgICAgICAgbGF0ZW5jeU1zOiBlbnZpcm9ubWVudCA9PT0gJ3Byb2R1Y3Rpb24nID8gMTAwMCA6IDMwMDBcbiAgICAgIH1cbiAgICB9LFxuICAgIFxuICAgIGNvc3RzOiB7XG4gICAgICBtb250aGx5QnVkZ2V0VXNkOiBnZXRCdWRnZXRGb3JFbnZpcm9ubWVudChlbnZpcm9ubWVudCksXG4gICAgICBlbmFibGVDb3N0QWxlcnRzOiBlbnZpcm9ubWVudCA9PT0gJ3Byb2R1Y3Rpb24nIC8vIE9ubHkgZW5hYmxlIGluIHByb2R1Y3Rpb24gZm9yIG5vd1xuICAgIH1cbiAgfTtcbiAgXG4gIHJldHVybiBiYXNlQ29uZmlnO1xufVxuXG5mdW5jdGlvbiBnZXRSZWdpb25Gb3JFbnZpcm9ubWVudChlbnZpcm9ubWVudDogc3RyaW5nKTogc3RyaW5nIHtcbiAgc3dpdGNoIChlbnZpcm9ubWVudCkge1xuICAgIGNhc2UgJ3Rlc3QnOlxuICAgICAgcmV0dXJuICdldS1ub3J0aC0xJzsgLy8gQ29zdC1vcHRpbWl6ZWQgcmVnaW9uXG4gICAgY2FzZSAncWEnOlxuICAgICAgcmV0dXJuICd1cy1lYXN0LTEnOyAvLyBQcm9kdWN0aW9uLWxpa2UgcmVnaW9uXG4gICAgY2FzZSAncHJvZHVjdGlvbic6XG4gICAgICByZXR1cm4gJ3VzLWVhc3QtMSc7IC8vIFByaW1hcnkgcHJvZHVjdGlvbiByZWdpb25cbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGVudmlyb25tZW50OiAke2Vudmlyb25tZW50fWApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldEFjY291bnRGb3JFbnZpcm9ubWVudChlbnZpcm9ubWVudDogc3RyaW5nKTogc3RyaW5nIHtcbiAgc3dpdGNoIChlbnZpcm9ubWVudCkge1xuICAgIGNhc2UgJ3Rlc3QnOlxuICAgICAgcmV0dXJuICc3Mjg0Mjc0NzAwNDYnOyAvLyBHYW1lVGVzdCBhY2NvdW50XG4gICAgY2FzZSAncWEnOlxuICAgICAgcmV0dXJuICcwNzcwMjk3ODQyOTEnOyAvLyBHYW1lUUEgYWNjb3VudFxuICAgIGNhc2UgJ3Byb2R1Y3Rpb24nOlxuICAgICAgcmV0dXJuICdUQkQnOyAvLyBQcm9kdWN0aW9uIGFjY291bnQgKHRvIGJlIGNyZWF0ZWQpXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBlbnZpcm9ubWVudDogJHtlbnZpcm9ubWVudH1gKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRCdWRnZXRGb3JFbnZpcm9ubWVudChlbnZpcm9ubWVudDogc3RyaW5nKTogbnVtYmVyIHtcbiAgc3dpdGNoIChlbnZpcm9ubWVudCkge1xuICAgIGNhc2UgJ3Rlc3QnOlxuICAgICAgcmV0dXJuIDUwOyAvLyAkNTAvbW9udGggYnVkZ2V0XG4gICAgY2FzZSAncWEnOlxuICAgICAgcmV0dXJuIDE1MDsgLy8gJDE1MC9tb250aCBidWRnZXRcbiAgICBjYXNlICdwcm9kdWN0aW9uJzpcbiAgICAgIHJldHVybiAxMDAwOyAvLyAkMTAwMC9tb250aCBidWRnZXRcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIDUwO1xuICB9XG59Il19