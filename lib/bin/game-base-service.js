#!/usr/bin/env node
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
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const game_base_service_stack_1 = require("../lib/game-base-service-stack");
const getEnvironmentConfig = (env) => {
    const configs = {
        test: { account: '728427470046', region: 'eu-north-1' },
        qa: { account: '077029784291', region: 'us-east-1' },
        production: { account: 'TBD', region: 'us-east-1' }
    };
    return configs[env] ?? configs.test;
};
const app = new cdk.App();
// Get environment from context or default to 'test'
const environment = (app.node.tryGetContext('environment') ?? 'test');
const envConfig = getEnvironmentConfig(environment);
// Validate environment
if (!['test', 'qa', 'production'].includes(environment)) {
    throw new Error(`Invalid environment: ${environment}. Must be one of: test, qa, production`);
}
// Create the stack with environment-specific configuration
new game_base_service_stack_1.GameBaseServiceStack(app, `GameBaseService-${environment}`, {
    environment,
    env: {
        account: envConfig.account,
        region: envConfig.region
    },
    // Stack-specific configuration
    stackName: `GameBaseService-${environment}`,
    description: `Loupeen RTS Platform - Base Building and Management Service (${environment})`,
    // Tags for cost tracking and resource management
    tags: {
        Project: 'Loupeen-RTS',
        Component: 'GameBaseService',
        Environment: environment,
        Epic: 'CoreGameSystems',
        Repository: 'game-base-service',
        CostCenter: `gaming-${environment}`,
        Owner: 'Platform-Team'
    }
});
// Synthesize the CloudFormation template
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FtZS1iYXNlLXNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9iaW4vZ2FtZS1iYXNlLXNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EsdUNBQXFDO0FBQ3JDLGlEQUFtQztBQUNuQyw0RUFBc0U7QUFPdEUsTUFBTSxvQkFBb0IsR0FBRyxDQUFDLEdBQVcsRUFBYSxFQUFFO0lBQ3RELE1BQU0sT0FBTyxHQUE4QjtRQUN6QyxJQUFJLEVBQUUsRUFBRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUU7UUFDdkQsRUFBRSxFQUFFLEVBQUUsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFO1FBQ3BELFVBQVUsRUFBRSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRTtLQUNwRCxDQUFDO0lBQ0YsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQztBQUN0QyxDQUFDLENBQUM7QUFFRixNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQixvREFBb0Q7QUFDcEQsTUFBTSxXQUFXLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsSUFBSSxNQUFNLENBQVcsQ0FBQztBQUNoRixNQUFNLFNBQVMsR0FBRyxvQkFBb0IsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUVwRCx1QkFBdUI7QUFDdkIsSUFBSSxDQUFDLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxZQUFZLENBQUMsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQztJQUN4RCxNQUFNLElBQUksS0FBSyxDQUFDLHdCQUF3QixXQUFXLHdDQUF3QyxDQUFDLENBQUM7QUFDL0YsQ0FBQztBQUVELDJEQUEyRDtBQUMzRCxJQUFJLDhDQUFvQixDQUFDLEdBQUcsRUFBRSxtQkFBbUIsV0FBVyxFQUFFLEVBQUU7SUFDOUQsV0FBVztJQUNYLEdBQUcsRUFBRTtRQUNILE9BQU8sRUFBRSxTQUFTLENBQUMsT0FBTztRQUMxQixNQUFNLEVBQUUsU0FBUyxDQUFDLE1BQU07S0FDekI7SUFFRCwrQkFBK0I7SUFDL0IsU0FBUyxFQUFFLG1CQUFtQixXQUFXLEVBQUU7SUFDM0MsV0FBVyxFQUFFLGdFQUFnRSxXQUFXLEdBQUc7SUFFM0YsaURBQWlEO0lBQ2pELElBQUksRUFBRTtRQUNKLE9BQU8sRUFBRSxhQUFhO1FBQ3RCLFNBQVMsRUFBRSxpQkFBaUI7UUFDNUIsV0FBVyxFQUFFLFdBQVc7UUFDeEIsSUFBSSxFQUFFLGlCQUFpQjtRQUN2QixVQUFVLEVBQUUsbUJBQW1CO1FBQy9CLFVBQVUsRUFBRSxVQUFVLFdBQVcsRUFBRTtRQUNuQyxLQUFLLEVBQUUsZUFBZTtLQUN2QjtDQUNGLENBQUMsQ0FBQztBQUVILHlDQUF5QztBQUN6QyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG5pbXBvcnQgJ3NvdXJjZS1tYXAtc3VwcG9ydC9yZWdpc3Rlcic7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgR2FtZUJhc2VTZXJ2aWNlU3RhY2sgfSBmcm9tICcuLi9saWIvZ2FtZS1iYXNlLXNlcnZpY2Utc3RhY2snO1xuLy8gVGVtcG9yYXJ5IG1vY2sgZm9yIHNoYXJlZC1jb25maWctbGlicmFyeVxuaW50ZXJmYWNlIEVudkNvbmZpZyB7XG4gIGFjY291bnQ6IHN0cmluZztcbiAgcmVnaW9uOiBzdHJpbmc7XG59XG5cbmNvbnN0IGdldEVudmlyb25tZW50Q29uZmlnID0gKGVudjogc3RyaW5nKTogRW52Q29uZmlnID0+IHtcbiAgY29uc3QgY29uZmlnczogUmVjb3JkPHN0cmluZywgRW52Q29uZmlnPiA9IHtcbiAgICB0ZXN0OiB7IGFjY291bnQ6ICc3Mjg0Mjc0NzAwNDYnLCByZWdpb246ICdldS1ub3J0aC0xJyB9LFxuICAgIHFhOiB7IGFjY291bnQ6ICcwNzcwMjk3ODQyOTEnLCByZWdpb246ICd1cy1lYXN0LTEnIH0sXG4gICAgcHJvZHVjdGlvbjogeyBhY2NvdW50OiAnVEJEJywgcmVnaW9uOiAndXMtZWFzdC0xJyB9XG4gIH07XG4gIHJldHVybiBjb25maWdzW2Vudl0gPz8gY29uZmlncy50ZXN0O1xufTtcblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcblxuLy8gR2V0IGVudmlyb25tZW50IGZyb20gY29udGV4dCBvciBkZWZhdWx0IHRvICd0ZXN0J1xuY29uc3QgZW52aXJvbm1lbnQgPSAoYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnZW52aXJvbm1lbnQnKSA/PyAndGVzdCcpIGFzIHN0cmluZztcbmNvbnN0IGVudkNvbmZpZyA9IGdldEVudmlyb25tZW50Q29uZmlnKGVudmlyb25tZW50KTtcblxuLy8gVmFsaWRhdGUgZW52aXJvbm1lbnRcbmlmICghWyd0ZXN0JywgJ3FhJywgJ3Byb2R1Y3Rpb24nXS5pbmNsdWRlcyhlbnZpcm9ubWVudCkpIHtcbiAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGVudmlyb25tZW50OiAke2Vudmlyb25tZW50fS4gTXVzdCBiZSBvbmUgb2Y6IHRlc3QsIHFhLCBwcm9kdWN0aW9uYCk7XG59XG5cbi8vIENyZWF0ZSB0aGUgc3RhY2sgd2l0aCBlbnZpcm9ubWVudC1zcGVjaWZpYyBjb25maWd1cmF0aW9uXG5uZXcgR2FtZUJhc2VTZXJ2aWNlU3RhY2soYXBwLCBgR2FtZUJhc2VTZXJ2aWNlLSR7ZW52aXJvbm1lbnR9YCwge1xuICBlbnZpcm9ubWVudCxcbiAgZW52OiB7XG4gICAgYWNjb3VudDogZW52Q29uZmlnLmFjY291bnQsXG4gICAgcmVnaW9uOiBlbnZDb25maWcucmVnaW9uXG4gIH0sXG4gIFxuICAvLyBTdGFjay1zcGVjaWZpYyBjb25maWd1cmF0aW9uXG4gIHN0YWNrTmFtZTogYEdhbWVCYXNlU2VydmljZS0ke2Vudmlyb25tZW50fWAsXG4gIGRlc2NyaXB0aW9uOiBgTG91cGVlbiBSVFMgUGxhdGZvcm0gLSBCYXNlIEJ1aWxkaW5nIGFuZCBNYW5hZ2VtZW50IFNlcnZpY2UgKCR7ZW52aXJvbm1lbnR9KWAsXG4gIFxuICAvLyBUYWdzIGZvciBjb3N0IHRyYWNraW5nIGFuZCByZXNvdXJjZSBtYW5hZ2VtZW50XG4gIHRhZ3M6IHtcbiAgICBQcm9qZWN0OiAnTG91cGVlbi1SVFMnLFxuICAgIENvbXBvbmVudDogJ0dhbWVCYXNlU2VydmljZScsIFxuICAgIEVudmlyb25tZW50OiBlbnZpcm9ubWVudCxcbiAgICBFcGljOiAnQ29yZUdhbWVTeXN0ZW1zJyxcbiAgICBSZXBvc2l0b3J5OiAnZ2FtZS1iYXNlLXNlcnZpY2UnLFxuICAgIENvc3RDZW50ZXI6IGBnYW1pbmctJHtlbnZpcm9ubWVudH1gLFxuICAgIE93bmVyOiAnUGxhdGZvcm0tVGVhbSdcbiAgfVxufSk7XG5cbi8vIFN5bnRoZXNpemUgdGhlIENsb3VkRm9ybWF0aW9uIHRlbXBsYXRlXG5hcHAuc3ludGgoKTsiXX0=