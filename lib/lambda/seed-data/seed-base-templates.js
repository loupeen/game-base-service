"use strict";
/**
 * CDK Custom Resource Lambda Function
 * Seeds the BASE_TEMPLATES_TABLE with initial base template data
 *
 * This Lambda function is invoked during CDK deployment to populate
 * the DynamoDB table with required game data using shared utilities.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
/* eslint-disable no-console, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions */
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const shared_cdk_constructs_1 = require("@loupeen/shared-cdk-constructs");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
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
/**
 * Base Templates Seeder Implementation
 */
class BaseTemplatesSeeder extends shared_cdk_constructs_1.TableSeederHandler {
    async seed() {
        console.log(`Seeding table: ${this.tableName}`);
        // Insert all base templates
        for (const template of BASE_TEMPLATES) {
            console.log(`Inserting template: ${template.templateId}`);
            const command = new lib_dynamodb_1.PutCommand({
                TableName: this.tableName,
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
        return {
            Message: 'Base templates seeded successfully',
            TemplateCount: BASE_TEMPLATES.length
        };
    }
    async cleanup() {
        console.log(`Cleaning up table: ${this.tableName}`);
        // Delete all base templates we created
        for (const template of BASE_TEMPLATES) {
            console.log(`Deleting template: ${template.templateId}`);
            const command = new lib_dynamodb_1.DeleteCommand({
                TableName: this.tableName,
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
    }
}
// Create handler instance and export the handler function
const seeder = new BaseTemplatesSeeder();
exports.handler = seeder.handle.bind(seeder);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VlZC1iYXNlLXRlbXBsYXRlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xhbWJkYS9zZWVkLWRhdGEvc2VlZC1iYXNlLXRlbXBsYXRlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFFSCwwTUFBME07QUFFMU0sOERBQTBEO0FBQzFELHdEQUEwRjtBQUMxRiwwRUFBb0U7QUFFcEUsTUFBTSxZQUFZLEdBQUcsSUFBSSxnQ0FBYyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQzVDLE1BQU0sU0FBUyxHQUFHLHFDQUFzQixDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUU1RCxzREFBc0Q7QUFDdEQsTUFBTSxjQUFjLEdBQUc7SUFDckI7UUFDRSxVQUFVLEVBQUUsd0JBQXdCO1FBQ3BDLFFBQVEsRUFBRSxnQkFBZ0I7UUFDMUIsS0FBSyxFQUFFLENBQUM7UUFDUixZQUFZLEVBQUU7WUFDWixTQUFTLEVBQUU7Z0JBQ1QsSUFBSSxFQUFFLElBQUk7Z0JBQ1YsSUFBSSxFQUFFLEdBQUc7Z0JBQ1QsU0FBUyxFQUFFLEdBQUc7YUFDZjtZQUNELFdBQVcsRUFBRSxDQUFDO1NBQ2Y7UUFDRCxLQUFLLEVBQUU7WUFDTCxNQUFNLEVBQUUsSUFBSTtZQUNaLE9BQU8sRUFBRSxHQUFHO1lBQ1osVUFBVSxFQUFFLEVBQUU7WUFDZCxPQUFPLEVBQUUsSUFBSTtTQUNkO1FBQ0QsU0FBUyxFQUFFLEdBQUcsQ0FBQyx1QkFBdUI7S0FDdkM7SUFDRDtRQUNFLFVBQVUsRUFBRSx3QkFBd0I7UUFDcEMsUUFBUSxFQUFFLGdCQUFnQjtRQUMxQixLQUFLLEVBQUUsQ0FBQztRQUNSLFlBQVksRUFBRTtZQUNaLFNBQVMsRUFBRTtnQkFDVCxJQUFJLEVBQUUsSUFBSTtnQkFDVixJQUFJLEVBQUUsSUFBSTtnQkFDVixTQUFTLEVBQUUsR0FBRzthQUNmO1lBQ0QsV0FBVyxFQUFFLENBQUM7U0FDZjtRQUNELEtBQUssRUFB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LE9BQU8sQ0FBQyxDQUFDO2dCQUM5QixPQUFPLENBQUMsR0FBRyxDQUFDLHVCQUF1QixRQUFRLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztZQUM1RCxDQUFDO1lBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztnQkFDcEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyx3QkFBd0IsUUFBUSxDQUFDLFVBQVUsS0FBSyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztnQkFDN0UsZ0NBQWdDO1lBQ2xDLENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBRUQsMERBQTBEO0FBQzFELE1BQU0sTUFBTSxHQUFHLElBQUksbUJBQW1CLEVBQUUsQ0FBQztBQUM1QixRQUFBLE9BQU8sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ0RLIEN1c3RvbSBSZXNvdXJjZSBMYW1iZGEgRnVuY3Rpb25cbiAqIFNlZWRzIHRoZSBCQVNFX1RFTVBMQVRFU19UQUJMRSB3aXRoIGluaXRpYWwgYmFzZSB0ZW1wbGF0ZSBkYXRhXG4gKiBcbiAqIFRoaXMgTGFtYmRhIGZ1bmN0aW9uIGlzIGludm9rZWQgZHVyaW5nIENESyBkZXBsb3ltZW50IHRvIHBvcHVsYXRlXG4gKiB0aGUgRHluYW1vREIgdGFibGUgd2l0aCByZXF1aXJlZCBnYW1lIGRhdGEgdXNpbmcgc2hhcmVkIHV0aWxpdGllcy5cbiAqL1xuXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1jb25zb2xlLCBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tdW5zYWZlLWFzc2lnbm1lbnQsIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnksIEB0eXBlc2NyaXB0LWVzbGludC9uby11bnNhZmUtbWVtYmVyLWFjY2VzcywgQHR5cGVzY3JpcHQtZXNsaW50L3Jlc3RyaWN0LXRlbXBsYXRlLWV4cHJlc3Npb25zICovXG5cbmltcG9ydCB7IER5bmFtb0RCQ2xpZW50IH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWR5bmFtb2RiJztcbmltcG9ydCB7IER5bmFtb0RCRG9jdW1lbnRDbGllbnQsIFB1dENvbW1hbmQsIERlbGV0ZUNvbW1hbmQgfSBmcm9tICdAYXdzLXNkay9saWItZHluYW1vZGInO1xuaW1wb3J0IHsgVGFibGVTZWVkZXJIYW5kbGVyIH0gZnJvbSAnQGxvdXBlZW4vc2hhcmVkLWNkay1jb25zdHJ1Y3RzJztcblxuY29uc3QgZHluYW1vQ2xpZW50ID0gbmV3IER5bmFtb0RCQ2xpZW50KHt9KTtcbmNvbnN0IGRvY0NsaWVudCA9IER5bmFtb0RCRG9jdW1lbnRDbGllbnQuZnJvbShkeW5hbW9DbGllbnQpO1xuXG4vLyBCYXNlIHRlbXBsYXRlIGRhdGEgLSBtYXRjaGVzIHRlc3QtZGF0YS50cyBzdHJ1Y3R1cmVcbmNvbnN0IEJBU0VfVEVNUExBVEVTID0gW1xuICB7XG4gICAgdGVtcGxhdGVJZDogJ2NvbW1hbmRfY2VudGVyLWxldmVsLTEnLFxuICAgIGJhc2VUeXBlOiAnY29tbWFuZF9jZW50ZXInLFxuICAgIGxldmVsOiAxLFxuICAgIHJlcXVpcmVtZW50czoge1xuICAgICAgcmVzb3VyY2VzOiB7XG4gICAgICAgIGdvbGQ6IDEwMDAsXG4gICAgICAgIGZvb2Q6IDUwMCxcbiAgICAgICAgbWF0ZXJpYWxzOiAyMDBcbiAgICAgIH0sXG4gICAgICBwbGF5ZXJMZXZlbDogMVxuICAgIH0sXG4gICAgc3RhdHM6IHtcbiAgICAgIGhlYWx0aDogMTAwMCxcbiAgICAgIGRlZmVuc2U6IDEwMCxcbiAgICAgIHByb2R1Y3Rpb246IDUwLFxuICAgICAgc3RvcmFnZTogMTAwMFxuICAgIH0sXG4gICAgYnVpbGRUaW1lOiAzMDAgLy8gNSBtaW51dGVzIGluIHNlY29uZHNcbiAgfSxcbiAge1xuICAgIHRlbXBsYXRlSWQ6ICdjb21tYW5kX2NlbnRlci1sZXZlbC0yJyxcbiAgICBiYXNlVHlwZTogJ2NvbW1hbmRfY2VudGVyJyxcbiAgICBsZXZlbDogMixcbiAgICByZXF1aXJlbWVudHM6IHtcbiAgICAgIHJlc291cmNlczoge1xuICAgICAgICBnb2xkOiAyMDAwLFxuICAgICAgICBmb29kOiAxMDAwLFxuICAgICAgICBtYXRlcmlhbHM6IDQwMFxuICAgICAgfSxcbiAgICAgIHBsYXllckxldmVsOiAyXG4gICAgfSxcbiAgICBzdGF0czoge1xuICAgICAgaGVhbHRoOiAxNTAwLFxuICAgICAgZGVmZW5zZTogMTUwLFxuICAgICAgcHJvZHVjdGlvbjogNzUsXG4gICAgICBzdG9yYWdlOiAxNTAwXG4gICAgfSxcbiAgICBidWlsZFRpbWU6IDYwMCAvLyAxMCBtaW51dGVzIGluIHNlY29uZHNcbiAgfSxcbiAge1xuICAgIHRlbXBsYXRlSWQ6ICdvdXRwb3N0LWxldmVsLTEnLFxuICAgIGJhc2VUeXBlOiAnb3V0cG9zdCcsXG4gICAgbGV2ZWw6IDEsXG4gICAgcmVxdWlyZW1lbnRzOiB7XG4gICAgICByZXNvdXJjZXM6IHtcbiAgICAgICAgZ29sZDogNTAwLFxuICAgICAgICBmb29kOiAyNTAsXG4gICAgICAgIG1hdGVyaWFsczogMTAwXG4gICAgICB9LFxuICAgICAgcGxheWVyTGV2ZWw6IDFcbiAgICB9LFxuICAgIHN0YXRzOiB7XG4gICAgICBoZWFsdGg6IDUwMCxcbiAgICAgIGRlZmVuc2U6IDUwLFxuICAgICAgcHJvZHVjdGlvbjogMjUsXG4gICAgICBzdG9yYWdlOiA1MDBcbiAgICB9LFxuICAgIGJ1aWxkVGltZTogMTgwIC8vIDMgbWludXRlcyBpbiBzZWNvbmRzXG4gIH0sXG4gIHtcbiAgICB0ZW1wbGF0ZUlkOiAnZm9ydHJlc3MtbGV2ZWwtMScsXG4gICAgYmFzZVR5cGU6ICdmb3J0cmVzcycsXG4gICAgbGV2ZWw6IDEsXG4gICAgcmVxdWlyZW1lbnRzOiB7XG4gICAgICByZXNvdXJjZXM6IHtcbiAgICAgICAgZ29sZDogMzAwMCxcbiAgICAgICAgZm9vZDogMTUwMCxcbiAgICAgICAgbWF0ZXJpYWxzOiA4MDBcbiAgICAgIH0sXG4gICAgICBwbGF5ZXJMZXZlbDogM1xuICAgIH0sXG4gICAgc3RhdHM6IHtcbiAgICAgIGhlYWx0aDogMjAwMCxcbiAgICAgIGRlZmVuc2U6IDMwMCxcbiAgICAgIHByb2R1Y3Rpb246IDAsIC8vIE5vIHByb2R1Y3Rpb24gLSBwdXJlIGRlZmVuc2VcbiAgICAgIHN0b3JhZ2U6IDgwMFxuICAgIH0sXG4gICAgYnVpbGRUaW1lOiAxMjAwIC8vIDIwIG1pbnV0ZXMgaW4gc2Vjb25kc1xuICB9LFxuICB7XG4gICAgdGVtcGxhdGVJZDogJ21pbmluZ19zdGF0aW9uLWxldmVsLTEnLFxuICAgIGJhc2VUeXBlOiAnbWluaW5nX3N0YXRpb24nLFxuICAgIGxldmVsOiAxLFxuICAgIHJlcXVpcmVtZW50czoge1xuICAgICAgcmVzb3VyY2VzOiB7XG4gICAgICAgIGdvbGQ6IDE1MDAsXG4gICAgICAgIGZvb2Q6IDgwMCxcbiAgICAgICAgbWF0ZXJpYWxzOiA0MDBcbiAgICAgIH0sXG4gICAgICBwbGF5ZXJMZXZlbDogMlxuICAgIH0sXG4gICAgc3RhdHM6IHtcbiAgICAgIGhlYWx0aDogODAwLFxuICAgICAgZGVmZW5zZTogNzUsXG4gICAgICBwcm9kdWN0aW9uOiAxMDAsIC8vIEhpZ2ggbWF0ZXJpYWwgcHJvZHVjdGlvblxuICAgICAgc3RvcmFnZTogMTIwMFxuICAgIH0sXG4gICAgYnVpbGRUaW1lOiA0NTAgLy8gNy41IG1pbnV0ZXMgaW4gc2Vjb25kc1xuICB9LFxuICB7XG4gICAgdGVtcGxhdGVJZDogJ3Jlc2VhcmNoX2xhYi1sZXZlbC0xJyxcbiAgICBiYXNlVHlwZTogJ3Jlc2VhcmNoX2xhYicsXG4gICAgbGV2ZWw6IDEsXG4gICAgcmVxdWlyZW1lbnRzOiB7XG4gICAgICByZXNvdXJjZXM6IHtcbiAgICAgICAgZ29sZDogMjUwMCxcbiAgICAgICAgZm9vZDogMTIwMCxcbiAgICAgICAgbWF0ZXJpYWxzOiA2MDBcbiAgICAgIH0sXG4gICAgICBwbGF5ZXJMZXZlbDogM1xuICAgIH0sXG4gICAgc3RhdHM6IHtcbiAgICAgIGhlYWx0aDogNjAwLFxuICAgICAgZGVmZW5zZTogNjAsXG4gICAgICBwcm9kdWN0aW9uOiAwLCAvLyBObyByZXNvdXJjZSBwcm9kdWN0aW9uIC0gcmVzZWFyY2ggZm9jdXNcbiAgICAgIHN0b3JhZ2U6IDYwMFxuICAgIH0sXG4gICAgYnVpbGRUaW1lOiA5MDAgLy8gMTUgbWludXRlcyBpbiBzZWNvbmRzXG4gIH1cbl07XG5cbi8qKlxuICogQmFzZSBUZW1wbGF0ZXMgU2VlZGVyIEltcGxlbWVudGF0aW9uXG4gKi9cbmNsYXNzIEJhc2VUZW1wbGF0ZXNTZWVkZXIgZXh0ZW5kcyBUYWJsZVNlZWRlckhhbmRsZXIge1xuICBwcm90ZWN0ZWQgYXN5bmMgc2VlZCgpOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnNvbGUubG9nKGBTZWVkaW5nIHRhYmxlOiAke3RoaXMudGFibGVOYW1lfWApO1xuICAgIFxuICAgIC8vIEluc2VydCBhbGwgYmFzZSB0ZW1wbGF0ZXNcbiAgICBmb3IgKGNvbnN0IHRlbXBsYXRlIG9mIEJBU0VfVEVNUExBVEVTKSB7XG4gICAgICBjb25zb2xlLmxvZyhgSW5zZXJ0aW5nIHRlbXBsYXRlOiAke3RlbXBsYXRlLnRlbXBsYXRlSWR9YCk7XG4gICAgICBcbiAgICAgIGNvbnN0IGNvbW1hbmQgPSBuZXcgUHV0Q29tbWFuZCh7XG4gICAgICAgIFRhYmxlTmFtZTogdGhpcy50YWJsZU5hbWUsXG4gICAgICAgIEl0ZW06IHRlbXBsYXRlLFxuICAgICAgICBDb25kaXRpb25FeHByZXNzaW9uOiAnYXR0cmlidXRlX25vdF9leGlzdHModGVtcGxhdGVJZCknIC8vIE9ubHkgaW5zZXJ0IGlmIGRvZXNuJ3QgZXhpc3RcbiAgICAgIH0pO1xuXG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBkb2NDbGllbnQuc2VuZChjb21tYW5kKTtcbiAgICAgICAgY29uc29sZS5sb2coYOKchSBJbnNlcnRlZCB0ZW1wbGF0ZTogJHt0ZW1wbGF0ZS50ZW1wbGF0ZUlkfWApO1xuICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICBpZiAoZXJyb3IubmFtZSA9PT0gJ0NvbmRpdGlvbmFsQ2hlY2tGYWlsZWRFeGNlcHRpb24nKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYOKaoO+4jyAgVGVtcGxhdGUgJHt0ZW1wbGF0ZS50ZW1wbGF0ZUlkfSBhbHJlYWR5IGV4aXN0cywgc2tpcHBpbmdgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBNZXNzYWdlOiAnQmFzZSB0ZW1wbGF0ZXMgc2VlZGVkIHN1Y2Nlc3NmdWxseScsXG4gICAgICBUZW1wbGF0ZUNvdW50OiBCQVNFX1RFTVBMQVRFUy5sZW5ndGhcbiAgICB9O1xuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIGNsZWFudXAoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc29sZS5sb2coYENsZWFuaW5nIHVwIHRhYmxlOiAke3RoaXMudGFibGVOYW1lfWApO1xuICAgIFxuICAgIC8vIERlbGV0ZSBhbGwgYmFzZSB0ZW1wbGF0ZXMgd2UgY3JlYXRlZFxuICAgIGZvciAoY29uc3QgdGVtcGxhdGUgb2YgQkFTRV9URU1QTEFURVMpIHtcbiAgICAgIGNvbnNvbGUubG9nKGBEZWxldGluZyB0ZW1wbGF0ZTogJHt0ZW1wbGF0ZS50ZW1wbGF0ZUlkfWApO1xuICAgICAgXG4gICAgICBjb25zdCBjb21tYW5kID0gbmV3IERlbGV0ZUNvbW1hbmQoe1xuICAgICAgICBUYWJsZU5hbWU6IHRoaXMudGFibGVOYW1lLFxuICAgICAgICBLZXk6IHtcbiAgICAgICAgICB0ZW1wbGF0ZUlkOiB0ZW1wbGF0ZS50ZW1wbGF0ZUlkXG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBkb2NDbGllbnQuc2VuZChjb21tYW5kKTtcbiAgICAgICAgY29uc29sZS5sb2coYOKchSBEZWxldGVkIHRlbXBsYXRlOiAke3RlbXBsYXRlLnRlbXBsYXRlSWR9YCk7XG4gICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGDimqDvuI8gIENvdWxkIG5vdCBkZWxldGUgJHt0ZW1wbGF0ZS50ZW1wbGF0ZUlkfTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAvLyBDb250aW51ZSB3aXRoIG90aGVyIGRlbGV0aW9uc1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vLyBDcmVhdGUgaGFuZGxlciBpbnN0YW5jZSBhbmQgZXhwb3J0IHRoZSBoYW5kbGVyIGZ1bmN0aW9uXG5jb25zdCBzZWVkZXIgPSBuZXcgQmFzZVRlbXBsYXRlc1NlZWRlcigpO1xuZXhwb3J0IGNvbnN0IGhhbmRsZXIgPSBzZWVkZXIuaGFuZGxlLmJpbmQoc2VlZGVyKTsiXX0=