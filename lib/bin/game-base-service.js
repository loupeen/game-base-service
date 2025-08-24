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
// Temporary mock for shared-config-library
const getEnvironmentConfig = (env) => {
    const configs = {
        test: { account: '728427470046', region: 'eu-north-1' },
        qa: { account: '077029784291', region: 'us-east-1' },
        production: { account: 'TBD', region: 'us-east-1' }
    };
    return configs[env] || configs.test;
};
const app = new cdk.App();
// Get environment from context or default to 'test'
const environment = app.node.tryGetContext('environment') || 'test';
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FtZS1iYXNlLXNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9iaW4vZ2FtZS1iYXNlLXNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EsdUNBQXFDO0FBQ3JDLGlEQUFtQztBQUNuQyw0RUFBc0U7QUFDdEUsMkNBQTJDO0FBQzNDLE1BQU0sb0JBQW9CLEdBQUcsQ0FBQyxHQUFXLEVBQUUsRUFBRTtJQUMzQyxNQUFNLE9BQU8sR0FBRztRQUNkLElBQUksRUFBRSxFQUFFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRTtRQUN2RCxFQUFFLEVBQUUsRUFBRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUU7UUFDcEQsVUFBVSxFQUFFLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFO0tBQ3BELENBQUM7SUFDRixPQUFPLE9BQU8sQ0FBQyxHQUEyQixDQUFDLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQztBQUM5RCxDQUFDLENBQUM7QUFFRixNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQixvREFBb0Q7QUFDcEQsTUFBTSxXQUFXLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLElBQUksTUFBTSxDQUFDO0FBQ3BFLE1BQU0sU0FBUyxHQUFHLG9CQUFvQixDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBRXBELHVCQUF1QjtBQUN2QixJQUFJLENBQUMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLFlBQVksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO0lBQ3hELE1BQU0sSUFBSSxLQUFLLENBQUMsd0JBQXdCLFdBQVcsd0NBQXdDLENBQUMsQ0FBQztBQUMvRixDQUFDO0FBRUQsMkRBQTJEO0FBQzNELElBQUksOENBQW9CLENBQUMsR0FBRyxFQUFFLG1CQUFtQixXQUFXLEVBQUUsRUFBRTtJQUM5RCxXQUFXO0lBQ1gsR0FBRyxFQUFFO1FBQ0gsT0FBTyxFQUFFLFNBQVMsQ0FBQyxPQUFPO1FBQzFCLE1BQU0sRUFBRSxTQUFTLENBQUMsTUFBTTtLQUN6QjtJQUVELCtCQUErQjtJQUMvQixTQUFTLEVBQUUsbUJBQW1CLFdBQVcsRUFBRTtJQUMzQyxXQUFXLEVBQUUsZ0VBQWdFLFdBQVcsR0FBRztJQUUzRixpREFBaUQ7SUFDakQsSUFBSSxFQUFFO1FBQ0osT0FBTyxFQUFFLGFBQWE7UUFDdEIsU0FBUyxFQUFFLGlCQUFpQjtRQUM1QixXQUFXLEVBQUUsV0FBVztRQUN4QixJQUFJLEVBQUUsaUJBQWlCO1FBQ3ZCLFVBQVUsRUFBRSxtQkFBbUI7UUFDL0IsVUFBVSxFQUFFLFVBQVUsV0FBVyxFQUFFO1FBQ25DLEtBQUssRUFBRSxlQUFlO0tBQ3ZCO0NBQ0YsQ0FBQyxDQUFDO0FBRUgseUNBQXlDO0FBQ3pDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBHYW1lQmFzZVNlcnZpY2VTdGFjayB9IGZyb20gJy4uL2xpYi9nYW1lLWJhc2Utc2VydmljZS1zdGFjayc7XG4vLyBUZW1wb3JhcnkgbW9jayBmb3Igc2hhcmVkLWNvbmZpZy1saWJyYXJ5XG5jb25zdCBnZXRFbnZpcm9ubWVudENvbmZpZyA9IChlbnY6IHN0cmluZykgPT4ge1xuICBjb25zdCBjb25maWdzID0ge1xuICAgIHRlc3Q6IHsgYWNjb3VudDogJzcyODQyNzQ3MDA0NicsIHJlZ2lvbjogJ2V1LW5vcnRoLTEnIH0sXG4gICAgcWE6IHsgYWNjb3VudDogJzA3NzAyOTc4NDI5MScsIHJlZ2lvbjogJ3VzLWVhc3QtMScgfSxcbiAgICBwcm9kdWN0aW9uOiB7IGFjY291bnQ6ICdUQkQnLCByZWdpb246ICd1cy1lYXN0LTEnIH1cbiAgfTtcbiAgcmV0dXJuIGNvbmZpZ3NbZW52IGFzIGtleW9mIHR5cGVvZiBjb25maWdzXSB8fCBjb25maWdzLnRlc3Q7XG59O1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuXG4vLyBHZXQgZW52aXJvbm1lbnQgZnJvbSBjb250ZXh0IG9yIGRlZmF1bHQgdG8gJ3Rlc3QnXG5jb25zdCBlbnZpcm9ubWVudCA9IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ2Vudmlyb25tZW50JykgfHwgJ3Rlc3QnO1xuY29uc3QgZW52Q29uZmlnID0gZ2V0RW52aXJvbm1lbnRDb25maWcoZW52aXJvbm1lbnQpO1xuXG4vLyBWYWxpZGF0ZSBlbnZpcm9ubWVudFxuaWYgKCFbJ3Rlc3QnLCAncWEnLCAncHJvZHVjdGlvbiddLmluY2x1ZGVzKGVudmlyb25tZW50KSkge1xuICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgZW52aXJvbm1lbnQ6ICR7ZW52aXJvbm1lbnR9LiBNdXN0IGJlIG9uZSBvZjogdGVzdCwgcWEsIHByb2R1Y3Rpb25gKTtcbn1cblxuLy8gQ3JlYXRlIHRoZSBzdGFjayB3aXRoIGVudmlyb25tZW50LXNwZWNpZmljIGNvbmZpZ3VyYXRpb25cbm5ldyBHYW1lQmFzZVNlcnZpY2VTdGFjayhhcHAsIGBHYW1lQmFzZVNlcnZpY2UtJHtlbnZpcm9ubWVudH1gLCB7XG4gIGVudmlyb25tZW50LFxuICBlbnY6IHtcbiAgICBhY2NvdW50OiBlbnZDb25maWcuYWNjb3VudCxcbiAgICByZWdpb246IGVudkNvbmZpZy5yZWdpb25cbiAgfSxcbiAgXG4gIC8vIFN0YWNrLXNwZWNpZmljIGNvbmZpZ3VyYXRpb25cbiAgc3RhY2tOYW1lOiBgR2FtZUJhc2VTZXJ2aWNlLSR7ZW52aXJvbm1lbnR9YCxcbiAgZGVzY3JpcHRpb246IGBMb3VwZWVuIFJUUyBQbGF0Zm9ybSAtIEJhc2UgQnVpbGRpbmcgYW5kIE1hbmFnZW1lbnQgU2VydmljZSAoJHtlbnZpcm9ubWVudH0pYCxcbiAgXG4gIC8vIFRhZ3MgZm9yIGNvc3QgdHJhY2tpbmcgYW5kIHJlc291cmNlIG1hbmFnZW1lbnRcbiAgdGFnczoge1xuICAgIFByb2plY3Q6ICdMb3VwZWVuLVJUUycsXG4gICAgQ29tcG9uZW50OiAnR2FtZUJhc2VTZXJ2aWNlJywgXG4gICAgRW52aXJvbm1lbnQ6IGVudmlyb25tZW50LFxuICAgIEVwaWM6ICdDb3JlR2FtZVN5c3RlbXMnLFxuICAgIFJlcG9zaXRvcnk6ICdnYW1lLWJhc2Utc2VydmljZScsXG4gICAgQ29zdENlbnRlcjogYGdhbWluZy0ke2Vudmlyb25tZW50fWAsXG4gICAgT3duZXI6ICdQbGF0Zm9ybS1UZWFtJ1xuICB9XG59KTtcblxuLy8gU3ludGhlc2l6ZSB0aGUgQ2xvdWRGb3JtYXRpb24gdGVtcGxhdGVcbmFwcC5zeW50aCgpOyJdfQ==