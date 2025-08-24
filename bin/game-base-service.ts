#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GameBaseServiceStack } from '../lib/game-base-service-stack';
import { getEnvironmentConfig } from '@loupeen/shared-config-library';

const app = new cdk.App();

// Get environment from context or default to 'test'
const environment = app.node.tryGetContext('environment') || 'test';
const envConfig = getEnvironmentConfig(environment);

// Validate environment
if (!['test', 'qa', 'production'].includes(environment)) {
  throw new Error(`Invalid environment: ${environment}. Must be one of: test, qa, production`);
}

// Create the stack with environment-specific configuration
new GameBaseServiceStack(app, `GameBaseService-${environment}`, {
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