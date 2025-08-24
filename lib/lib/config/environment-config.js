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
            architecture: 'ARM_64', // 20% cost savings
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
            enableCostAlerts: true
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW52aXJvbm1lbnQtY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vY29uZmlnL2Vudmlyb25tZW50LWNvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOztBQXVESCw0REFrREM7QUFsREQsU0FBZ0Isd0JBQXdCLENBQUMsV0FBbUI7SUFDMUQsTUFBTSxVQUFVLEdBQTBCO1FBQ3hDLFdBQVc7UUFDWCxNQUFNLEVBQUUsdUJBQXVCLENBQUMsV0FBVyxDQUFDO1FBQzVDLE9BQU8sRUFBRSx3QkFBd0IsQ0FBQyxXQUFXLENBQUM7UUFFOUMsS0FBSyxFQUFFO1lBQ0wsaUJBQWlCLEVBQUU7Z0JBQ2pCLElBQUksRUFBRSxDQUFDO2dCQUNQLFlBQVksRUFBRSxFQUFFO2FBQ2pCO1lBQ0QsWUFBWSxFQUFFO2dCQUNaLGVBQWUsRUFBRSxXQUFXLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxlQUFlO2dCQUNqRSxnQkFBZ0IsRUFBRSxHQUFHO2FBQ3RCO1lBQ0QsUUFBUSxFQUFFO2dCQUNSLGtCQUFrQixFQUFFLEVBQUU7Z0JBQ3RCLGFBQWEsRUFBRSxFQUFFO2FBQ2xCO1NBQ0Y7UUFFRCxNQUFNLEVBQUU7WUFDTixVQUFVLEVBQUUsV0FBVyxLQUFLLFlBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHO1lBQ3JELE9BQU8sRUFBRSxFQUFFO1lBQ1gsWUFBWSxFQUFFLFFBQVEsRUFBRSxtQkFBbUI7WUFDM0MsT0FBTyxFQUFFLFlBQVk7U0FDdEI7UUFFRCxRQUFRLEVBQUU7WUFDUixXQUFXLEVBQUUsV0FBVyxLQUFLLFlBQVksQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLGlCQUFpQjtZQUNqRixtQkFBbUIsRUFBRSxXQUFXLEtBQUssWUFBWTtZQUNqRCxrQkFBa0IsRUFBRSxXQUFXLEtBQUssWUFBWTtTQUNqRDtRQUVELFVBQVUsRUFBRTtZQUNWLGlCQUFpQixFQUFFLFdBQVcsS0FBSyxNQUFNO1lBQ3pDLGdCQUFnQixFQUFFLFdBQVcsS0FBSyxZQUFZLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN2RCxlQUFlLEVBQUU7Z0JBQ2YsU0FBUyxFQUFFLFdBQVcsS0FBSyxZQUFZLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLFdBQVc7Z0JBQ2xFLFNBQVMsRUFBRSxXQUFXLEtBQUssWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUk7YUFDdEQ7U0FDRjtRQUVELEtBQUssRUFBRTtZQUNMLGdCQUFnQixFQUFFLHVCQUF1QixDQUFDLFdBQVcsQ0FBQztZQUN0RCxnQkFBZ0IsRUFBRSxJQUFJO1NBQ3ZCO0tBQ0YsQ0FBQztJQUVGLE9BQU8sVUFBVSxDQUFDO0FBQ3BCLENBQUM7QUFFRCxTQUFTLHVCQUF1QixDQUFDLFdBQW1CO0lBQ2xELFFBQVEsV0FBVyxFQUFFLENBQUM7UUFDcEIsS0FBSyxNQUFNO1lBQ1QsT0FBTyxZQUFZLENBQUMsQ0FBQyx3QkFBd0I7UUFDL0MsS0FBSyxJQUFJO1lBQ1AsT0FBTyxXQUFXLENBQUMsQ0FBQyx5QkFBeUI7UUFDL0MsS0FBSyxZQUFZO1lBQ2YsT0FBTyxXQUFXLENBQUMsQ0FBQyw0QkFBNEI7UUFDbEQ7WUFDRSxNQUFNLElBQUksS0FBSyxDQUFDLHdCQUF3QixXQUFXLEVBQUUsQ0FBQyxDQUFDO0lBQzNELENBQUM7QUFDSCxDQUFDO0FBRUQsU0FBUyx3QkFBd0IsQ0FBQyxXQUFtQjtJQUNuRCxRQUFRLFdBQVcsRUFBRSxDQUFDO1FBQ3BCLEtBQUssTUFBTTtZQUNULE9BQU8sY0FBYyxDQUFDLENBQUMsbUJBQW1CO1FBQzVDLEtBQUssSUFBSTtZQUNQLE9BQU8sY0FBYyxDQUFDLENBQUMsaUJBQWlCO1FBQzFDLEtBQUssWUFBWTtZQUNmLE9BQU8sS0FBSyxDQUFDLENBQUMscUNBQXFDO1FBQ3JEO1lBQ0UsTUFBTSxJQUFJLEtBQUssQ0FBQyx3QkFBd0IsV0FBVyxFQUFFLENBQUMsQ0FBQztJQUMzRCxDQUFDO0FBQ0gsQ0FBQztBQUVELFNBQVMsdUJBQXVCLENBQUMsV0FBbUI7SUFDbEQsUUFBUSxXQUFXLEVBQUUsQ0FBQztRQUNwQixLQUFLLE1BQU07WUFDVCxPQUFPLEVBQUUsQ0FBQyxDQUFDLG1CQUFtQjtRQUNoQyxLQUFLLElBQUk7WUFDUCxPQUFPLEdBQUcsQ0FBQyxDQUFDLG9CQUFvQjtRQUNsQyxLQUFLLFlBQVk7WUFDZixPQUFPLElBQUksQ0FBQyxDQUFDLHFCQUFxQjtRQUNwQztZQUNFLE9BQU8sRUFBRSxDQUFDO0lBQ2QsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEVudmlyb25tZW50LXNwZWNpZmljIGNvbmZpZ3VyYXRpb24gZm9yIEdhbWUgQmFzZSBTZXJ2aWNlXG4gKiBGb2xsb3dpbmcgc2hhcmVkLWNvbmZpZy1saWJyYXJ5IHBhdHRlcm5zIHdpdGggZ2FtaW5nIG9wdGltaXphdGlvbnNcbiAqL1xuXG5leHBvcnQgaW50ZXJmYWNlIEdhbWVCYXNlU2VydmljZUNvbmZpZyB7XG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG4gIHJlZ2lvbjogc3RyaW5nO1xuICBhY2NvdW50OiBzdHJpbmc7XG4gIFxuICAvLyBCYXNlIHNlcnZpY2Ugc3BlY2lmaWMgY29uZmlndXJhdGlvblxuICBiYXNlczoge1xuICAgIG1heEJhc2VzUGVyUGxheWVyOiB7XG4gICAgICBmcmVlOiBudW1iZXI7XG4gICAgICBzdWJzY3JpcHRpb246IG51bWJlcjtcbiAgICB9O1xuICAgIGJhc2VNb3ZlbWVudDoge1xuICAgICAgY29vbGRvd25NaW51dGVzOiBudW1iZXI7XG4gICAgICB0ZWxlcG9ydENvc3RHb2xkOiBudW1iZXI7XG4gICAgfTtcbiAgICBzcGF3bmluZzoge1xuICAgICAgbmV3UGxheWVyR3JvdXBTaXplOiBudW1iZXI7XG4gICAgICBzcGF3blJhZGl1c0ttOiBudW1iZXI7XG4gICAgfTtcbiAgfTtcbiAgXG4gIC8vIFBlcmZvcm1hbmNlIGFuZCBjb3N0IG9wdGltaXphdGlvblxuICBsYW1iZGE6IHtcbiAgICBtZW1vcnlTaXplOiBudW1iZXI7XG4gICAgdGltZW91dDogbnVtYmVyO1xuICAgIGFyY2hpdGVjdHVyZTogJ0FSTV82NCcgfCAnWDg2XzY0JztcbiAgICBydW50aW1lOiBzdHJpbmc7XG4gIH07XG4gIFxuICAvLyBEeW5hbW9EQiBjb25maWd1cmF0aW9uXG4gIGR5bmFtb2RiOiB7XG4gICAgYmlsbGluZ01vZGU6ICdQQVlfUEVSX1JFUVVFU1QnIHwgJ1BST1ZJU0lPTkVEJztcbiAgICBwb2ludEluVGltZVJlY292ZXJ5OiBib29sZWFuO1xuICAgIGRlbGV0aW9uUHJvdGVjdGlvbjogYm9vbGVhbjtcbiAgfTtcbiAgXG4gIC8vIE1vbml0b3JpbmcgYW5kIG9ic2VydmFiaWxpdHlcbiAgbW9uaXRvcmluZzoge1xuICAgIGVuYWJsZVhSYXlUcmFjaW5nOiBib29sZWFuO1xuICAgIGxvZ1JldGVudGlvbkRheXM6IG51bWJlcjtcbiAgICBhbGFybVRocmVzaG9sZHM6IHtcbiAgICAgIGVycm9yUmF0ZTogbnVtYmVyO1xuICAgICAgbGF0ZW5jeU1zOiBudW1iZXI7XG4gICAgfTtcbiAgfTtcbiAgXG4gIC8vIENvc3QgY29udHJvbHNcbiAgY29zdHM6IHtcbiAgICBtb250aGx5QnVkZ2V0VXNkOiBudW1iZXI7XG4gICAgZW5hYmxlQ29zdEFsZXJ0czogYm9vbGVhbjtcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEdhbWVCYXNlU2VydmljZUNvbmZpZyhlbnZpcm9ubWVudDogc3RyaW5nKTogR2FtZUJhc2VTZXJ2aWNlQ29uZmlnIHtcbiAgY29uc3QgYmFzZUNvbmZpZzogR2FtZUJhc2VTZXJ2aWNlQ29uZmlnID0ge1xuICAgIGVudmlyb25tZW50LFxuICAgIHJlZ2lvbjogZ2V0UmVnaW9uRm9yRW52aXJvbm1lbnQoZW52aXJvbm1lbnQpLFxuICAgIGFjY291bnQ6IGdldEFjY291bnRGb3JFbnZpcm9ubWVudChlbnZpcm9ubWVudCksXG4gICAgXG4gICAgYmFzZXM6IHtcbiAgICAgIG1heEJhc2VzUGVyUGxheWVyOiB7XG4gICAgICAgIGZyZWU6IDUsXG4gICAgICAgIHN1YnNjcmlwdGlvbjogMTBcbiAgICAgIH0sXG4gICAgICBiYXNlTW92ZW1lbnQ6IHtcbiAgICAgICAgY29vbGRvd25NaW51dGVzOiBlbnZpcm9ubWVudCA9PT0gJ3Rlc3QnID8gMSA6IDYwLCAvLyBGYXN0IHRlc3RpbmdcbiAgICAgICAgdGVsZXBvcnRDb3N0R29sZDogMTAwXG4gICAgICB9LFxuICAgICAgc3Bhd25pbmc6IHtcbiAgICAgICAgbmV3UGxheWVyR3JvdXBTaXplOiA1MCxcbiAgICAgICAgc3Bhd25SYWRpdXNLbTogMTBcbiAgICAgIH1cbiAgICB9LFxuICAgIFxuICAgIGxhbWJkYToge1xuICAgICAgbWVtb3J5U2l6ZTogZW52aXJvbm1lbnQgPT09ICdwcm9kdWN0aW9uJyA/IDEwMjQgOiA1MTIsXG4gICAgICB0aW1lb3V0OiAzMCxcbiAgICAgIGFyY2hpdGVjdHVyZTogJ0FSTV82NCcsIC8vIDIwJSBjb3N0IHNhdmluZ3NcbiAgICAgIHJ1bnRpbWU6ICdub2RlanMxOC54J1xuICAgIH0sXG4gICAgXG4gICAgZHluYW1vZGI6IHtcbiAgICAgIGJpbGxpbmdNb2RlOiBlbnZpcm9ubWVudCA9PT0gJ3Byb2R1Y3Rpb24nID8gJ1BBWV9QRVJfUkVRVUVTVCcgOiAnUEFZX1BFUl9SRVFVRVNUJyxcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IGVudmlyb25tZW50ID09PSAncHJvZHVjdGlvbicsXG4gICAgICBkZWxldGlvblByb3RlY3Rpb246IGVudmlyb25tZW50ID09PSAncHJvZHVjdGlvbidcbiAgICB9LFxuICAgIFxuICAgIG1vbml0b3Jpbmc6IHtcbiAgICAgIGVuYWJsZVhSYXlUcmFjaW5nOiBlbnZpcm9ubWVudCAhPT0gJ3Rlc3QnLFxuICAgICAgbG9nUmV0ZW50aW9uRGF5czogZW52aXJvbm1lbnQgPT09ICdwcm9kdWN0aW9uJyA/IDMwIDogNyxcbiAgICAgIGFsYXJtVGhyZXNob2xkczoge1xuICAgICAgICBlcnJvclJhdGU6IGVudmlyb25tZW50ID09PSAncHJvZHVjdGlvbicgPyAwLjAxIDogMC4wNSwgLy8gMSUgdnMgNSVcbiAgICAgICAgbGF0ZW5jeU1zOiBlbnZpcm9ubWVudCA9PT0gJ3Byb2R1Y3Rpb24nID8gMTAwMCA6IDMwMDBcbiAgICAgIH1cbiAgICB9LFxuICAgIFxuICAgIGNvc3RzOiB7XG4gICAgICBtb250aGx5QnVkZ2V0VXNkOiBnZXRCdWRnZXRGb3JFbnZpcm9ubWVudChlbnZpcm9ubWVudCksXG4gICAgICBlbmFibGVDb3N0QWxlcnRzOiB0cnVlXG4gICAgfVxuICB9O1xuICBcbiAgcmV0dXJuIGJhc2VDb25maWc7XG59XG5cbmZ1bmN0aW9uIGdldFJlZ2lvbkZvckVudmlyb25tZW50KGVudmlyb25tZW50OiBzdHJpbmcpOiBzdHJpbmcge1xuICBzd2l0Y2ggKGVudmlyb25tZW50KSB7XG4gICAgY2FzZSAndGVzdCc6XG4gICAgICByZXR1cm4gJ2V1LW5vcnRoLTEnOyAvLyBDb3N0LW9wdGltaXplZCByZWdpb25cbiAgICBjYXNlICdxYSc6XG4gICAgICByZXR1cm4gJ3VzLWVhc3QtMSc7IC8vIFByb2R1Y3Rpb24tbGlrZSByZWdpb25cbiAgICBjYXNlICdwcm9kdWN0aW9uJzpcbiAgICAgIHJldHVybiAndXMtZWFzdC0xJzsgLy8gUHJpbWFyeSBwcm9kdWN0aW9uIHJlZ2lvblxuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gZW52aXJvbm1lbnQ6ICR7ZW52aXJvbm1lbnR9YCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0QWNjb3VudEZvckVudmlyb25tZW50KGVudmlyb25tZW50OiBzdHJpbmcpOiBzdHJpbmcge1xuICBzd2l0Y2ggKGVudmlyb25tZW50KSB7XG4gICAgY2FzZSAndGVzdCc6XG4gICAgICByZXR1cm4gJzcyODQyNzQ3MDA0Nic7IC8vIEdhbWVUZXN0IGFjY291bnRcbiAgICBjYXNlICdxYSc6XG4gICAgICByZXR1cm4gJzA3NzAyOTc4NDI5MSc7IC8vIEdhbWVRQSBhY2NvdW50XG4gICAgY2FzZSAncHJvZHVjdGlvbic6XG4gICAgICByZXR1cm4gJ1RCRCc7IC8vIFByb2R1Y3Rpb24gYWNjb3VudCAodG8gYmUgY3JlYXRlZClcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGVudmlyb25tZW50OiAke2Vudmlyb25tZW50fWApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldEJ1ZGdldEZvckVudmlyb25tZW50KGVudmlyb25tZW50OiBzdHJpbmcpOiBudW1iZXIge1xuICBzd2l0Y2ggKGVudmlyb25tZW50KSB7XG4gICAgY2FzZSAndGVzdCc6XG4gICAgICByZXR1cm4gNTA7IC8vICQ1MC9tb250aCBidWRnZXRcbiAgICBjYXNlICdxYSc6XG4gICAgICByZXR1cm4gMTUwOyAvLyAkMTUwL21vbnRoIGJ1ZGdldFxuICAgIGNhc2UgJ3Byb2R1Y3Rpb24nOlxuICAgICAgcmV0dXJuIDEwMDA7IC8vICQxMDAwL21vbnRoIGJ1ZGdldFxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gNTA7XG4gIH1cbn0iXX0=