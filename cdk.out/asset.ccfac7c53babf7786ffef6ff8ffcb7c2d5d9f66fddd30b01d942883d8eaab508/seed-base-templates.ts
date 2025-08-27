/**
 * CDK Custom Resource Lambda Function
 * Seeds the BASE_TEMPLATES_TABLE with initial base template data
 * 
 * This Lambda function is invoked during CDK deployment to populate
 * the DynamoDB table with required game data.
 */

/* eslint-disable no-console, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions */

import { CloudFormationCustomResourceEvent, CloudFormationCustomResourceResponse } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const BASE_TEMPLATES_TABLE = process.env.BASE_TEMPLATES_TABLE!;

// Base template data - matches test-data.ts structure
const BASE_TEMPLATES = [
  {
    templateId: 'command_center-level-1',
    baseType: 'command_center',
    level: 1,
    requirements: {
      resources: {
        gold: 1000,
        food: 500,
        materials: 200
      },
      playerLevel: 1
    },
    stats: {
      health: 1000,
      defense: 100,
      production: 50,
      storage: 1000
    },
    buildTime: 300 // 5 minutes in seconds
  },
  {
    templateId: 'command_center-level-2',
    baseType: 'command_center',
    level: 2,
    requirements: {
      resources: {
        gold: 2000,
        food: 1000,
        materials: 400
      },
      playerLevel: 2
    },
    stats: {
      health: 1500,
      defense: 150,
      production: 75,
      storage: 1500
    },
    buildTime: 600 // 10 minutes in seconds
  },
  {
    templateId: 'outpost-level-1',
    baseType: 'outpost',
    level: 1,
    requirements: {
      resources: {
        gold: 500,
        food: 250,
        materials: 100
      },
      playerLevel: 1
    },
    stats: {
      health: 500,
      defense: 50,
      production: 25,
      storage: 500
    },
    buildTime: 180 // 3 minutes in seconds
  },
  {
    templateId: 'fortress-level-1',
    baseType: 'fortress',
    level: 1,
    requirements: {
      resources: {
        gold: 3000,
        food: 1500,
        materials: 800
      },
      playerLevel: 3
    },
    stats: {
      health: 2000,
      defense: 300,
      production: 0, // No production - pure defense
      storage: 800
    },
    buildTime: 1200 // 20 minutes in seconds
  },
  {
    templateId: 'mining_station-level-1',
    baseType: 'mining_station',
    level: 1,
    requirements: {
      resources: {
        gold: 1500,
        food: 800,
        materials: 400
      },
      playerLevel: 2
    },
    stats: {
      health: 800,
      defense: 75,
      production: 100, // High material production
      storage: 1200
    },
    buildTime: 450 // 7.5 minutes in seconds
  },
  {
    templateId: 'research_lab-level-1',
    baseType: 'research_lab',
    level: 1,
    requirements: {
      resources: {
        gold: 2500,
        food: 1200,
        materials: 600
      },
      playerLevel: 3
    },
    stats: {
      health: 600,
      defense: 60,
      production: 0, // No resource production - research focus
      storage: 600
    },
    buildTime: 900 // 15 minutes in seconds
  }
];

export const handler = async (
  event: CloudFormationCustomResourceEvent
): Promise<CloudFormationCustomResourceResponse> => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  const { RequestType, StackId, RequestId, LogicalResourceId } = event;
  const physicalId = (event as any).PhysicalResourceId ?? `seed-base-templates-${Date.now()}`;

  try {
    switch (RequestType) {
      case 'Create':
      case 'Update':
        console.log(`Seeding BASE_TEMPLATES_TABLE: ${BASE_TEMPLATES_TABLE}`);
        
        // Insert all base templates
        for (const template of BASE_TEMPLATES) {
          console.log(`Inserting template: ${template.templateId}`);
          
          const command = new PutCommand({
            TableName: BASE_TEMPLATES_TABLE,
            Item: template,
            ConditionExpression: 'attribute_not_exists(templateId)' // Only insert if doesn't exist
          });

          try {
            await docClient.send(command);
            console.log(`✅ Inserted template: ${template.templateId}`);
          } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
              console.log(`⚠️  Template ${template.templateId} already exists, skipping`);
            } else {
              throw error;
            }
          }
        }

        console.log('✅ Base template seeding completed successfully');
        break;

      case 'Delete':
        console.log(`Cleaning up BASE_TEMPLATES_TABLE: ${BASE_TEMPLATES_TABLE}`);
        
        // Delete all base templates we created
        for (const template of BASE_TEMPLATES) {
          console.log(`Deleting template: ${template.templateId}`);
          
          const command = new DeleteCommand({
            TableName: BASE_TEMPLATES_TABLE,
            Key: {
              templateId: template.templateId
            }
          });

          try {
            await docClient.send(command);
            console.log(`✅ Deleted template: ${template.templateId}`);
          } catch (error: any) {
            console.log(`⚠️  Could not delete ${template.templateId}: ${error.message}`);
            // Continue with other deletions
          }
        }

        console.log('✅ Base template cleanup completed');
        break;

      default:
        throw new Error(`Unknown request type: ${RequestType}`);
    }

    return {
      Status: 'SUCCESS',
      StackId,
      RequestId,
      LogicalResourceId,
      PhysicalResourceId: physicalId,
      Data: {
        Message: `Base templates ${RequestType.toLowerCase()} completed successfully`,
        TemplateCount: BASE_TEMPLATES.length
      }
    };

  } catch (error) {
    console.error('❌ Error in base template seeding:', error);
    
    return {
      Status: 'FAILED',
      StackId,
      RequestId,
      LogicalResourceId,
      PhysicalResourceId: physicalId,
      Reason: `Failed to ${RequestType.toLowerCase()} base templates: ${(error as Error).message}`,
      Data: {
        Error: (error as Error).message
      }
    };
  }
};