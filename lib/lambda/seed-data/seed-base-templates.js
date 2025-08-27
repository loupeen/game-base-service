"use strict";
/**
 * CDK Custom Resource Lambda Function
 * Seeds the BASE_TEMPLATES_TABLE with initial base template data
 *
 * This Lambda function is invoked during CDK deployment to populate
 * the DynamoDB table with required game data.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const BASE_TEMPLATES_TABLE = process.env.BASE_TEMPLATES_TABLE;
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
const handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));
    const { RequestType, StackId, RequestId, LogicalResourceId } = event;
    const physicalId = event.PhysicalResourceId ?? `seed-base-templates-${Date.now()}`;
    try {
        switch (RequestType) {
            case 'Create':
            case 'Update':
                console.log(`Seeding BASE_TEMPLATES_TABLE: ${BASE_TEMPLATES_TABLE}`);
                // Insert all base templates
                for (const template of BASE_TEMPLATES) {
                    console.log(`Inserting template: ${template.templateId}`);
                    const command = new lib_dynamodb_1.PutCommand({
                        TableName: BASE_TEMPLATES_TABLE,
                        Item: template,
                        ConditionExpression: 'attribute_not_exists(templateId)' // Only insert if doesn't exist
                    });
                    try {
                        await docClient.send(command);
                        console.log(`✅ Inserted template: ${template.templateId}`);
                    }
                    catch (error) {
                        if (error.name === 'ConditionalCheckFailedException') {
                            console.log(`⚠️  Template ${template.templateId} already exists, skipping`);
                        }
                        else {
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
                    const command = new lib_dynamodb_1.DeleteCommand({
                        TableName: BASE_TEMPLATES_TABLE,
                        Key: {
                            templateId: template.templateId
                        }
                    });
                    try {
                        await docClient.send(command);
                        console.log(`✅ Deleted template: ${template.templateId}`);
                    }
                    catch (error) {
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
    }
    catch (error) {
        console.error('❌ Error in base template seeding:', error);
        return {
            Status: 'FAILED',
            StackId,
            RequestId,
            LogicalResourceId,
            PhysicalResourceId: physicalId,
            Reason: `Failed to ${RequestType.toLowerCase()} base templates: ${error.message}`,
            Data: {
                Error: error.message
            }
        };
    }
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VlZC1iYXNlLXRlbXBsYXRlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xhbWJkYS9zZWVkLWRhdGEvc2VlZC1iYXNlLXRlbXBsYXRlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFLSCw4REFBMEQ7QUFDMUQsd0RBQTBGO0FBRTFGLE1BQU0sWUFBWSxHQUFHLElBQUksZ0NBQWMsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUM1QyxNQUFNLFNBQVMsR0FBRyxxQ0FBc0IsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7QUFFNUQsTUFBTSxvQkFBb0IsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLG9CQUFxQixDQUFDO0FBRS9ELHNEQUFzRDtBQUN0RCxNQUFNLGNBQWMsR0FBRztJQUNyQjtRQUNFLFVBQVUsRUFBRSx3QkFBd0I7UUFDcEMsUUFBUSxFQUFFLGdCQUFnQjtRQUMxQixLQUFLLEVBQUUsQ0FBQztRQUNSLFlBQVksRUFBRTtZQUNaLFNBQVMsRUFBRTtnQkFDVCxJQUFJLEVBQUUsSUFBSTtnQkFDVixJQUFJLEVBQUUsR0FBRztnQkFDVCxTQUFTLEVBQUUsR0FBRzthQUNmO1lBQ0QsV0FBVyxFQUFFLENBQUM7U0FDZjtRQUNELEtBQUssRUFBRTtZQUNMLE1BQU0sRUFBRSxJQUFJO1lBQ1osT0FBTyxFQUFFLEdBQUc7WUFDWixVQUFVLEVBQUUsRUFBRTtZQUNkLE9BQU8sRUFBRSxJQUFJO1NBQ2Q7UUFDRCxTQUFTLEVBQUUsR0FBRyxDQUFDLHVCQUF1QjtLQUN2QztJQUNEO1FBQ0UsVUFBVSxFQUFFLHdCQUF3QjtRQUNwQyxRQUFRLEVBQUUsZ0JBQWdCO1FBQzFCLEtBQUssRUFBRSxDQUFDO1FBQ1IsWUFBWSxFQUFFO1lBQ1osU0FBUyxFQUFFO2dCQUNULElBQUksRUFBRSxJQUFJO2dCQUNWLElBQUksRUFBRSxJQUFJO2dCQUNWLFNBQVMsRUFBRSxHQUFHO2FBQ2Y7WUFDRCxXQUFX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LENBQUMsS0FBSyxDQUFDLG1DQUFtQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRTFELE9BQU87WUFDTCxNQUFNLEVBQUUsUUFBUTtZQUNoQixPQUFPO1lBQ1AsU0FBUztZQUNULGlCQUFpQjtZQUNqQixrQkFBa0IsRUFBRSxVQUFVO1lBQzlCLE1BQU0sRUFBRSxhQUFhLFdBQVcsQ0FBQyxXQUFXLEVBQUUsb0JBQXFCLEtBQWUsQ0FBQyxPQUFPLEVBQUU7WUFDNUYsSUFBSSxFQUFFO2dCQUNKLEtBQUssRUFBRyxLQUFlLENBQUMsT0FBTzthQUNoQztTQUNGLENBQUM7SUFDSixDQUFDO0FBQ0gsQ0FBQyxDQUFDO0FBaEdXLFFBQUEsT0FBTyxXQWdHbEIiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENESyBDdXN0b20gUmVzb3VyY2UgTGFtYmRhIEZ1bmN0aW9uXG4gKiBTZWVkcyB0aGUgQkFTRV9URU1QTEFURVNfVEFCTEUgd2l0aCBpbml0aWFsIGJhc2UgdGVtcGxhdGUgZGF0YVxuICogXG4gKiBUaGlzIExhbWJkYSBmdW5jdGlvbiBpcyBpbnZva2VkIGR1cmluZyBDREsgZGVwbG95bWVudCB0byBwb3B1bGF0ZVxuICogdGhlIER5bmFtb0RCIHRhYmxlIHdpdGggcmVxdWlyZWQgZ2FtZSBkYXRhLlxuICovXG5cbi8qIGVzbGludC1kaXNhYmxlIG5vLWNvbnNvbGUsIEB0eXBlc2NyaXB0LWVzbGludC9uby11bnNhZmUtYXNzaWdubWVudCwgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueSwgQHR5cGVzY3JpcHQtZXNsaW50L25vLXVuc2FmZS1tZW1iZXItYWNjZXNzLCBAdHlwZXNjcmlwdC1lc2xpbnQvcmVzdHJpY3QtdGVtcGxhdGUtZXhwcmVzc2lvbnMgKi9cblxuaW1wb3J0IHsgQ2xvdWRGb3JtYXRpb25DdXN0b21SZXNvdXJjZUV2ZW50LCBDbG91ZEZvcm1hdGlvbkN1c3RvbVJlc291cmNlUmVzcG9uc2UgfSBmcm9tICdhd3MtbGFtYmRhJztcbmltcG9ydCB7IER5bmFtb0RCQ2xpZW50IH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWR5bmFtb2RiJztcbmltcG9ydCB7IER5bmFtb0RCRG9jdW1lbnRDbGllbnQsIFB1dENvbW1hbmQsIERlbGV0ZUNvbW1hbmQgfSBmcm9tICdAYXdzLXNkay9saWItZHluYW1vZGInO1xuXG5jb25zdCBkeW5hbW9DbGllbnQgPSBuZXcgRHluYW1vREJDbGllbnQoe30pO1xuY29uc3QgZG9jQ2xpZW50ID0gRHluYW1vREJEb2N1bWVudENsaWVudC5mcm9tKGR5bmFtb0NsaWVudCk7XG5cbmNvbnN0IEJBU0VfVEVNUExBVEVTX1RBQkxFID0gcHJvY2Vzcy5lbnYuQkFTRV9URU1QTEFURVNfVEFCTEUhO1xuXG4vLyBCYXNlIHRlbXBsYXRlIGRhdGEgLSBtYXRjaGVzIHRlc3QtZGF0YS50cyBzdHJ1Y3R1cmVcbmNvbnN0IEJBU0VfVEVNUExBVEVTID0gW1xuICB7XG4gICAgdGVtcGxhdGVJZDogJ2NvbW1hbmRfY2VudGVyLWxldmVsLTEnLFxuICAgIGJhc2VUeXBlOiAnY29tbWFuZF9jZW50ZXInLFxuICAgIGxldmVsOiAxLFxuICAgIHJlcXVpcmVtZW50czoge1xuICAgICAgcmVzb3VyY2VzOiB7XG4gICAgICAgIGdvbGQ6IDEwMDAsXG4gICAgICAgIGZvb2Q6IDUwMCxcbiAgICAgICAgbWF0ZXJpYWxzOiAyMDBcbiAgICAgIH0sXG4gICAgICBwbGF5ZXJMZXZlbDogMVxuICAgIH0sXG4gICAgc3RhdHM6IHtcbiAgICAgIGhlYWx0aDogMTAwMCxcbiAgICAgIGRlZmVuc2U6IDEwMCxcbiAgICAgIHByb2R1Y3Rpb246IDUwLFxuICAgICAgc3RvcmFnZTogMTAwMFxuICAgIH0sXG4gICAgYnVpbGRUaW1lOiAzMDAgLy8gNSBtaW51dGVzIGluIHNlY29uZHNcbiAgfSxcbiAge1xuICAgIHRlbXBsYXRlSWQ6ICdjb21tYW5kX2NlbnRlci1sZXZlbC0yJyxcbiAgICBiYXNlVHlwZTogJ2NvbW1hbmRfY2VudGVyJyxcbiAgICBsZXZlbDogMixcbiAgICByZXF1aXJlbWVudHM6IHtcbiAgICAgIHJlc291cmNlczoge1xuICAgICAgICBnb2xkOiAyMDAwLFxuICAgICAgICBmb29kOiAxMDAwLFxuICAgICAgICBtYXRlcmlhbHM6IDQwMFxuICAgICAgfSxcbiAgICAgIHBsYXllckxldmVsOiAyXG4gICAgfSxcbiAgICBzdGF0czoge1xuICAgICAgaGVhbHRoOiAxNTAwLFxuICAgICAgZGVmZW5zZTogMTUwLFxuICAgICAgcHJvZHVjdGlvbjogNzUsXG4gICAgICBzdG9yYWdlOiAxNTAwXG4gICAgfSxcbiAgICBidWlsZFRpbWU6IDYwMCAvLyAxMCBtaW51dGVzIGluIHNlY29uZHNcbiAgfSxcbiAge1xuICAgIHRlbXBsYXRlSWQ6ICdvdXRwb3N0LWxldmVsLTEnLFxuICAgIGJhc2VUeXBlOiAnb3V0cG9zdCcsXG4gICAgbGV2ZWw6IDEsXG4gICAgcmVxdWlyZW1lbnRzOiB7XG4gICAgICByZXNvdXJjZXM6IHtcbiAgICAgICAgZ29sZDogNTAwLFxuICAgICAgICBmb29kOiAyNTAsXG4gICAgICAgIG1hdGVyaWFsczogMTAwXG4gICAgICB9LFxuICAgICAgcGxheWVyTGV2ZWw6IDFcbiAgICB9LFxuICAgIHN0YXRzOiB7XG4gICAgICBoZWFsdGg6IDUwMCxcbiAgICAgIGRlZmVuc2U6IDUwLFxuICAgICAgcHJvZHVjdGlvbjogMjUsXG4gICAgICBzdG9yYWdlOiA1MDBcbiAgICB9LFxuICAgIGJ1aWxkVGltZTogMTgwIC8vIDMgbWludXRlcyBpbiBzZWNvbmRzXG4gIH0sXG4gIHtcbiAgICB0ZW1wbGF0ZUlkOiAnZm9ydHJlc3MtbGV2ZWwtMScsXG4gICAgYmFzZVR5cGU6ICdmb3J0cmVzcycsXG4gICAgbGV2ZWw6IDEsXG4gICAgcmVxdWlyZW1lbnRzOiB7XG4gICAgICByZXNvdXJjZXM6IHtcbiAgICAgICAgZ29sZDogMzAwMCxcbiAgICAgICAgZm9vZDogMTUwMCxcbiAgICAgICAgbWF0ZXJpYWxzOiA4MDBcbiAgICAgIH0sXG4gICAgICBwbGF5ZXJMZXZlbDogM1xuICAgIH0sXG4gICAgc3RhdHM6IHtcbiAgICAgIGhlYWx0aDogMjAwMCxcbiAgICAgIGRlZmVuc2U6IDMwMCxcbiAgICAgIHByb2R1Y3Rpb246IDAsIC8vIE5vIHByb2R1Y3Rpb24gLSBwdXJlIGRlZmVuc2VcbiAgICAgIHN0b3JhZ2U6IDgwMFxuICAgIH0sXG4gICAgYnVpbGRUaW1lOiAxMjAwIC8vIDIwIG1pbnV0ZXMgaW4gc2Vjb25kc1xuICB9LFxuICB7XG4gICAgdGVtcGxhdGVJZDogJ21pbmluZ19zdGF0aW9uLWxldmVsLTEnLFxuICAgIGJhc2VUeXBlOiAnbWluaW5nX3N0YXRpb24nLFxuICAgIGxldmVsOiAxLFxuICAgIHJlcXVpcmVtZW50czoge1xuICAgICAgcmVzb3VyY2VzOiB7XG4gICAgICAgIGdvbGQ6IDE1MDAsXG4gICAgICAgIGZvb2Q6IDgwMCxcbiAgICAgICAgbWF0ZXJpYWxzOiA0MDBcbiAgICAgIH0sXG4gICAgICBwbGF5ZXJMZXZlbDogMlxuICAgIH0sXG4gICAgc3RhdHM6IHtcbiAgICAgIGhlYWx0aDogODAwLFxuICAgICAgZGVmZW5zZTogNzUsXG4gICAgICBwcm9kdWN0aW9uOiAxMDAsIC8vIEhpZ2ggbWF0ZXJpYWwgcHJvZHVjdGlvblxuICAgICAgc3RvcmFnZTogMTIwMFxuICAgIH0sXG4gICAgYnVpbGRUaW1lOiA0NTAgLy8gNy41IG1pbnV0ZXMgaW4gc2Vjb25kc1xuICB9LFxuICB7XG4gICAgdGVtcGxhdGVJZDogJ3Jlc2VhcmNoX2xhYi1sZXZlbC0xJyxcbiAgICBiYXNlVHlwZTogJ3Jlc2VhcmNoX2xhYicsXG4gICAgbGV2ZWw6IDEsXG4gICAgcmVxdWlyZW1lbnRzOiB7XG4gICAgICByZXNvdXJjZXM6IHtcbiAgICAgICAgZ29sZDogMjUwMCxcbiAgICAgICAgZm9vZDogMTIwMCxcbiAgICAgICAgbWF0ZXJpYWxzOiA2MDBcbiAgICAgIH0sXG4gICAgICBwbGF5ZXJMZXZlbDogM1xuICAgIH0sXG4gICAgc3RhdHM6IHtcbiAgICAgIGhlYWx0aDogNjAwLFxuICAgICAgZGVmZW5zZTogNjAsXG4gICAgICBwcm9kdWN0aW9uOiAwLCAvLyBObyByZXNvdXJjZSBwcm9kdWN0aW9uIC0gcmVzZWFyY2ggZm9jdXNcbiAgICAgIHN0b3JhZ2U6IDYwMFxuICAgIH0sXG4gICAgYnVpbGRUaW1lOiA5MDAgLy8gMTUgbWludXRlcyBpbiBzZWNvbmRzXG4gIH1cbl07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVyID0gYXN5bmMgKFxuICBldmVudDogQ2xvdWRGb3JtYXRpb25DdXN0b21SZXNvdXJjZUV2ZW50XG4pOiBQcm9taXNlPENsb3VkRm9ybWF0aW9uQ3VzdG9tUmVzb3VyY2VSZXNwb25zZT4gPT4ge1xuICBjb25zb2xlLmxvZygnUmVjZWl2ZWQgZXZlbnQ6JywgSlNPTi5zdHJpbmdpZnkoZXZlbnQsIG51bGwsIDIpKTtcblxuICBjb25zdCB7IFJlcXVlc3RUeXBlLCBTdGFja0lkLCBSZXF1ZXN0SWQsIExvZ2ljYWxSZXNvdXJjZUlkIH0gPSBldmVudDtcbiAgY29uc3QgcGh5c2ljYWxJZCA9IChldmVudCBhcyBhbnkpLlBoeXNpY2FsUmVzb3VyY2VJZCA/PyBgc2VlZC1iYXNlLXRlbXBsYXRlcy0ke0RhdGUubm93KCl9YDtcblxuICB0cnkge1xuICAgIHN3aXRjaCAoUmVxdWVzdFR5cGUpIHtcbiAgICAgIGNhc2UgJ0NyZWF0ZSc6XG4gICAgICBjYXNlICdVcGRhdGUnOlxuICAgICAgICBjb25zb2xlLmxvZyhgU2VlZGluZyBCQVNFX1RFTVBMQVRFU19UQUJMRTogJHtCQVNFX1RFTVBMQVRFU19UQUJMRX1gKTtcbiAgICAgICAgXG4gICAgICAgIC8vIEluc2VydCBhbGwgYmFzZSB0ZW1wbGF0ZXNcbiAgICAgICAgZm9yIChjb25zdCB0ZW1wbGF0ZSBvZiBCQVNFX1RFTVBMQVRFUykge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBJbnNlcnRpbmcgdGVtcGxhdGU6ICR7dGVtcGxhdGUudGVtcGxhdGVJZH1gKTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCBjb21tYW5kID0gbmV3IFB1dENvbW1hbmQoe1xuICAgICAgICAgICAgVGFibGVOYW1lOiBCQVNFX1RFTVBMQVRFU19UQUJMRSxcbiAgICAgICAgICAgIEl0ZW06IHRlbXBsYXRlLFxuICAgICAgICAgICAgQ29uZGl0aW9uRXhwcmVzc2lvbjogJ2F0dHJpYnV0ZV9ub3RfZXhpc3RzKHRlbXBsYXRlSWQpJyAvLyBPbmx5IGluc2VydCBpZiBkb2Vzbid0IGV4aXN0XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgZG9jQ2xpZW50LnNlbmQoY29tbWFuZCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhg4pyFIEluc2VydGVkIHRlbXBsYXRlOiAke3RlbXBsYXRlLnRlbXBsYXRlSWR9YCk7XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgaWYgKGVycm9yLm5hbWUgPT09ICdDb25kaXRpb25hbENoZWNrRmFpbGVkRXhjZXB0aW9uJykge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhg4pqg77iPICBUZW1wbGF0ZSAke3RlbXBsYXRlLnRlbXBsYXRlSWR9IGFscmVhZHkgZXhpc3RzLCBza2lwcGluZ2ApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc29sZS5sb2coJ+KchSBCYXNlIHRlbXBsYXRlIHNlZWRpbmcgY29tcGxldGVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSAnRGVsZXRlJzpcbiAgICAgICAgY29uc29sZS5sb2coYENsZWFuaW5nIHVwIEJBU0VfVEVNUExBVEVTX1RBQkxFOiAke0JBU0VfVEVNUExBVEVTX1RBQkxFfWApO1xuICAgICAgICBcbiAgICAgICAgLy8gRGVsZXRlIGFsbCBiYXNlIHRlbXBsYXRlcyB3ZSBjcmVhdGVkXG4gICAgICAgIGZvciAoY29uc3QgdGVtcGxhdGUgb2YgQkFTRV9URU1QTEFURVMpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgRGVsZXRpbmcgdGVtcGxhdGU6ICR7dGVtcGxhdGUudGVtcGxhdGVJZH1gKTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCBjb21tYW5kID0gbmV3IERlbGV0ZUNvbW1hbmQoe1xuICAgICAgICAgICAgVGFibGVOYW1lOiBCQVNFX1RFTVBMQVRFU19UQUJMRSxcbiAgICAgICAgICAgIEtleToge1xuICAgICAgICAgICAgICB0ZW1wbGF0ZUlkOiB0ZW1wbGF0ZS50ZW1wbGF0ZUlkXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgZG9jQ2xpZW50LnNlbmQoY29tbWFuZCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhg4pyFIERlbGV0ZWQgdGVtcGxhdGU6ICR7dGVtcGxhdGUudGVtcGxhdGVJZH1gKTtcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhg4pqg77iPICBDb3VsZCBub3QgZGVsZXRlICR7dGVtcGxhdGUudGVtcGxhdGVJZH06ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIC8vIENvbnRpbnVlIHdpdGggb3RoZXIgZGVsZXRpb25zXG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc29sZS5sb2coJ+KchSBCYXNlIHRlbXBsYXRlIGNsZWFudXAgY29tcGxldGVkJyk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gcmVxdWVzdCB0eXBlOiAke1JlcXVlc3RUeXBlfWApO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBTdGF0dXM6ICdTVUNDRVNTJyxcbiAgICAgIFN0YWNrSWQsXG4gICAgICBSZXF1ZXN0SWQsXG4gICAgICBMb2dpY2FsUmVzb3VyY2VJZCxcbiAgICAgIFBoeXNpY2FsUmVzb3VyY2VJZDogcGh5c2ljYWxJZCxcbiAgICAgIERhdGE6IHtcbiAgICAgICAgTWVzc2FnZTogYEJhc2UgdGVtcGxhdGVzICR7UmVxdWVzdFR5cGUudG9Mb3dlckNhc2UoKX0gY29tcGxldGVkIHN1Y2Nlc3NmdWxseWAsXG4gICAgICAgIFRlbXBsYXRlQ291bnQ6IEJBU0VfVEVNUExBVEVTLmxlbmd0aFxuICAgICAgfVxuICAgIH07XG5cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCfinYwgRXJyb3IgaW4gYmFzZSB0ZW1wbGF0ZSBzZWVkaW5nOicsIGVycm9yKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgU3RhdHVzOiAnRkFJTEVEJyxcbiAgICAgIFN0YWNrSWQsXG4gICAgICBSZXF1ZXN0SWQsXG4gICAgICBMb2dpY2FsUmVzb3VyY2VJZCxcbiAgICAgIFBoeXNpY2FsUmVzb3VyY2VJZDogcGh5c2ljYWxJZCxcbiAgICAgIFJlYXNvbjogYEZhaWxlZCB0byAke1JlcXVlc3RUeXBlLnRvTG93ZXJDYXNlKCl9IGJhc2UgdGVtcGxhdGVzOiAkeyhlcnJvciBhcyBFcnJvcikubWVzc2FnZX1gLFxuICAgICAgRGF0YToge1xuICAgICAgICBFcnJvcjogKGVycm9yIGFzIEVycm9yKS5tZXNzYWdlXG4gICAgICB9XG4gICAgfTtcbiAgfVxufTsiXX0=