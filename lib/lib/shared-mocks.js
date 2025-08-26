"use strict";
/**
 * Temporary mock implementations for shared libraries
 * This allows testing and development when shared packages are not available
 */
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
exports.MockLoggingConstruct = exports.createConfigFromEnvironment = exports.publishCustomMetric = exports.validateRequest = exports.withErrorHandling = exports.GameEngineError = exports.StructuredLogger = void 0;
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const cdk = __importStar(require("aws-cdk-lib"));
const constructs_1 = require("constructs");
// Mock StructuredLogger
class StructuredLogger {
    context;
    constructor(context) {
        this.context = context;
    }
    info(message, details) {
        console.log(`[INFO] ${this.context}: ${message}`, details ?? '');
    }
    warn(message, details) {
        console.warn(`[WARN] ${this.context}: ${message}`, details ?? '');
    }
    error(message, details) {
        console.error(`[ERROR] ${this.context}: ${message}`, details ?? '');
    }
    debug(message, details) {
        if (process.env.NODE_ENV === 'development') {
            console.debug(`[DEBUG] ${this.context}: ${message}`, details ?? '');
        }
    }
}
exports.StructuredLogger = StructuredLogger;
// Mock GameEngineError
class GameEngineError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.name = 'GameEngineError';
        this.code = code;
        this.details = details;
    }
}
exports.GameEngineError = GameEngineError;
// Mock withErrorHandling
const withErrorHandling = async (handler, logger) => {
    try {
        return await handler();
    }
    catch (error) {
        logger?.error('Error in handler', { error: error.message });
        if (error instanceof GameEngineError) {
            throw error;
        }
        // Convert unknown errors to GameEngineError
        throw new GameEngineError(error.message || 'Internal server error', 'INTERNAL_ERROR', { originalError: error });
    }
};
exports.withErrorHandling = withErrorHandling;
// Mock validateRequest
const validateRequest = async (schema, body) => {
    if (!body) {
        throw new GameEngineError('Request body is required', 'VALIDATION_ERROR');
    }
    try {
        const parsed = JSON.parse(body);
        return schema.parse(parsed);
    }
    catch (error) {
        throw new GameEngineError('Invalid request format', 'VALIDATION_ERROR', { error: error.message });
    }
};
exports.validateRequest = validateRequest;
// Mock publishCustomMetric
const publishCustomMetric = async (namespace, metricName, value, dimensions) => {
    console.log(`[METRIC] ${namespace}/${metricName}: ${value}`, dimensions || '');
};
exports.publishCustomMetric = publishCustomMetric;
// Mock createConfigFromEnvironment
const createConfigFromEnvironment = (environment) => {
    const env = environment || process.env.ENVIRONMENT || 'development';
    return {
        environment: env,
        region: process.env.AWS_REGION || 'eu-north-1',
        costs: {
            enableCostAlerts: env === 'production',
            monthlyBudgetUsd: env === 'production' ? 1000 : env === 'qa' ? 200 : 100
        },
        monitoring: {
            alarmThresholds: {
                errorRate: env === 'production' ? 5 : 10,
                latencyMs: env === 'production' ? 1000 : 3000
            }
        }
    };
};
exports.createConfigFromEnvironment = createConfigFromEnvironment;
// Mock CDK constructs
class MockLoggingConstruct extends constructs_1.Construct {
    logGroup;
    constructor(scope, id) {
        super(scope, id);
        this.logGroup = new logs.LogGroup(this, 'LogGroup', {
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });
    }
}
exports.MockLoggingConstruct = MockLoggingConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhcmVkLW1vY2tzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc2hhcmVkLW1vY2tzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O0dBR0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDJEQUE2QztBQUM3QyxpREFBbUM7QUFDbkMsMkNBQXVDO0FBRXZDLHdCQUF3QjtBQUN4QixNQUFhLGdCQUFnQjtJQUNuQixPQUFPLENBQVM7SUFFeEIsWUFBWSxPQUFlO1FBQ3pCLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO0lBQ3pCLENBQUM7SUFFRCxJQUFJLENBQUMsT0FBZSxFQUFFLE9BQWlDO1FBQ3JELE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxJQUFJLENBQUMsT0FBTyxLQUFLLE9BQU8sRUFBRSxFQUFFLE9BQU8sSUFBSSxFQUFFLENBQUMsQ0FBQztJQUNuRSxDQUFDO0lBRUQsSUFBSSxDQUFDLE9BQWUsRUFBRSxPQUFpQztRQUNyRCxPQUFPLENBQUMsSUFBSSxDQUFDLFVBQVUsSUFBSSxDQUFDLE9BQU8sS0FBSyxPQUFPLEVBQUUsRUFBRSxPQUFPLElBQUksRUFBRSxDQUFDLENBQUM7SUFDcEUsQ0FBQztJQUVELEtBQUssQ0FBQyxPQUFlLEVBQUUsT0FBaUM7UUFDdEQsT0FBTyxDQUFDLEtBQUssQ0FBQyxXQUFXLElBQUksQ0FBQyxPQUFPLEtBQUssT0FBTyxFQUFFLEVBQUUsT0FBTyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ3RFLENBQUM7SUFFRCxLQUFLLENBQUMsT0FBZSxFQUFFLE9BQWlDO1FBQ3RELElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEtBQUssYUFBYSxFQUFFLENBQUM7WUFDM0MsT0FBTyxDQUFDLEtBQUssQ0FBQyxXQUFXLElBQUksQ0FBQyxPQUFPLEtBQUssT0FBTyxFQUFFLEVBQUUsT0FBTyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3RFLENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUF4QkQsNENBd0JDO0FBRUQsdUJBQXVCO0FBQ3ZCLE1BQWEsZUFBZ0IsU0FBUSxLQUFLO0lBQ3hCLElBQUksQ0FBUztJQUNiLE9BQU8sQ0FBMkI7SUFFbEQsWUFBWSxPQUFlLEVBQUUsSUFBWSxFQUFFLE9BQWlDO1FBQzFFLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNmLElBQUksQ0FBQyxJQUFJLEdBQUcsaUJBQWlCLENBQUM7UUFDOUIsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7UUFDakIsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7SUFDekIsQ0FBQztDQUNGO0FBVkQsMENBVUM7QUFFRCx5QkFBeUI7QUFDbEIsTUFBTSxpQkFBaUIsR0FBRyxLQUFLLEVBQ3BDLE9BQXlCLEVBQ3pCLE1BQXlCLEVBQ2IsRUFBRTtJQUNkLElBQUksQ0FBQztRQUNILE9BQU8sTUFBTSxPQUFPLEVBQUUsQ0FBQztJQUN6QixDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE1BQU0sRUFBRSxLQUFLLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxLQUFLLEVBQUcsS0FBZSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFFdkUsSUFBSSxLQUFLLFlBQVksZUFBZSxFQUFFLENBQUM7WUFDckMsTUFBTSxLQUFLLENBQUM7UUFDZCxDQUFDO1FBRUQsNENBQTRDO1FBQzVDLE1BQU0sSUFBSSxlQUFlLENBQ3RCLEtBQWUsQ0FBQyxPQUFPLElBQUksdUJBQXVCLEVBQ25ELGdCQUFnQixFQUNoQixFQUFFLGFBQWEsRUFBRSxLQUFLLEVBQUUsQ0FDekIsQ0FBQztJQUNKLENBQUM7QUFDSCxDQUFDLENBQUM7QUFwQlcsUUFBQSxpQkFBaUIscUJBb0I1QjtBQUVGLHVCQUF1QjtBQUNoQixNQUFNLGVBQWUsR0FBRyxLQUFLLEVBQ2xDLE1BQXVDLEVBQ3ZDLElBQW1CLEVBQ1AsRUFBRTtJQUNkLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNWLE1BQU0sSUFBSSxlQUFlLENBQUMsMEJBQTBCLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztJQUM1RSxDQUFDO0lBRUQsSUFBSSxDQUFDO1FBQ0gsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNoQyxPQUFPLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDOUIsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixNQUFNLElBQUksZUFBZSxDQUFDLHdCQUF3QixFQUFFLGtCQUFrQixFQUFFLEVBQUUsS0FBSyxFQUFHLEtBQWUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBQy9HLENBQUM7QUFDSCxDQUFDLENBQUM7QUFkVyxRQUFBLGVBQWUsbUJBYzFCO0FBRUYsMkJBQTJCO0FBQ3BCLE1BQU0sbUJBQW1CLEdBQUcsS0FBSyxFQUN0QyxTQUFpQixFQUNqQixVQUFrQixFQUNsQixLQUFhLEVBQ2IsVUFBbUMsRUFDcEIsRUFBRTtJQUNqQixPQUFPLENBQUMsR0FBRyxDQUFDLFlBQVksU0FBUyxJQUFJLFVBQVUsS0FBSyxLQUFLLEVBQUUsRUFBRSxVQUFVLElBQUksRUFBRSxDQUFDLENBQUM7QUFDakYsQ0FBQyxDQUFDO0FBUFcsUUFBQSxtQkFBbUIsdUJBTzlCO0FBa0JGLG1DQUFtQztBQUM1QixNQUFNLDJCQUEyQixHQUFHLENBQUMsV0FBb0IsRUFBeUIsRUFBRTtJQUN6RixNQUFNLEdBQUcsR0FBRyxXQUFXLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLElBQUksYUFBYSxDQUFDO0lBRXBFLE9BQU87UUFDTCxXQUFXLEVBQUUsR0FBRztRQUNoQixNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLElBQUksWUFBWTtRQUM5QyxLQUFLLEVBQUU7WUFDTCxnQkFBZ0IsRUFBRSxHQUFHLEtBQUssWUFBWTtZQUN0QyxnQkFBZ0IsRUFBRSxHQUFHLEtBQUssWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRztTQUN6RTtRQUNELFVBQVUsRUFBRTtZQUNWLGVBQWUsRUFBRTtnQkFDZixTQUFTLEVBQUUsR0FBRyxLQUFLLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO2dCQUN4QyxTQUFTLEVBQUUsR0FBRyxLQUFLLFlBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJO2FBQzlDO1NBQ0Y7S0FDRixDQUFDO0FBQ0osQ0FBQyxDQUFDO0FBakJXLFFBQUEsMkJBQTJCLCtCQWlCdEM7QUFFRixzQkFBc0I7QUFDdEIsTUFBYSxvQkFBcUIsU0FBUSxzQkFBUztJQUNqQyxRQUFRLENBQWdCO0lBRXhDLFlBQVksS0FBZ0IsRUFBRSxFQUFVO1FBQ3RDLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUNsRCxTQUFTLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRO1lBQ3RDLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDekMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBWEQsb0RBV0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRlbXBvcmFyeSBtb2NrIGltcGxlbWVudGF0aW9ucyBmb3Igc2hhcmVkIGxpYnJhcmllc1xuICogVGhpcyBhbGxvd3MgdGVzdGluZyBhbmQgZGV2ZWxvcG1lbnQgd2hlbiBzaGFyZWQgcGFja2FnZXMgYXJlIG5vdCBhdmFpbGFibGVcbiAqL1xuXG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuLy8gTW9jayBTdHJ1Y3R1cmVkTG9nZ2VyXG5leHBvcnQgY2xhc3MgU3RydWN0dXJlZExvZ2dlciB7XG4gIHByaXZhdGUgY29udGV4dDogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKGNvbnRleHQ6IHN0cmluZykge1xuICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gIH1cblxuICBpbmZvKG1lc3NhZ2U6IHN0cmluZywgZGV0YWlscz86IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogdm9pZCB7XG4gICAgY29uc29sZS5sb2coYFtJTkZPXSAke3RoaXMuY29udGV4dH06ICR7bWVzc2FnZX1gLCBkZXRhaWxzID8/ICcnKTtcbiAgfVxuXG4gIHdhcm4obWVzc2FnZTogc3RyaW5nLCBkZXRhaWxzPzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiB2b2lkIHtcbiAgICBjb25zb2xlLndhcm4oYFtXQVJOXSAke3RoaXMuY29udGV4dH06ICR7bWVzc2FnZX1gLCBkZXRhaWxzID8/ICcnKTtcbiAgfVxuXG4gIGVycm9yKG1lc3NhZ2U6IHN0cmluZywgZGV0YWlscz86IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogdm9pZCB7XG4gICAgY29uc29sZS5lcnJvcihgW0VSUk9SXSAke3RoaXMuY29udGV4dH06ICR7bWVzc2FnZX1gLCBkZXRhaWxzID8/ICcnKTtcbiAgfVxuXG4gIGRlYnVnKG1lc3NhZ2U6IHN0cmluZywgZGV0YWlscz86IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogdm9pZCB7XG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAnZGV2ZWxvcG1lbnQnKSB7XG4gICAgICBjb25zb2xlLmRlYnVnKGBbREVCVUddICR7dGhpcy5jb250ZXh0fTogJHttZXNzYWdlfWAsIGRldGFpbHMgPz8gJycpO1xuICAgIH1cbiAgfVxufVxuXG4vLyBNb2NrIEdhbWVFbmdpbmVFcnJvclxuZXhwb3J0IGNsYXNzIEdhbWVFbmdpbmVFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgcHVibGljIHJlYWRvbmx5IGNvZGU6IHN0cmluZztcbiAgcHVibGljIHJlYWRvbmx5IGRldGFpbHM/OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcblxuICBjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcsIGNvZGU6IHN0cmluZywgZGV0YWlscz86IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gICAgdGhpcy5uYW1lID0gJ0dhbWVFbmdpbmVFcnJvcic7XG4gICAgdGhpcy5jb2RlID0gY29kZTtcbiAgICB0aGlzLmRldGFpbHMgPSBkZXRhaWxzO1xuICB9XG59XG5cbi8vIE1vY2sgd2l0aEVycm9ySGFuZGxpbmdcbmV4cG9ydCBjb25zdCB3aXRoRXJyb3JIYW5kbGluZyA9IGFzeW5jIDxUPihcbiAgaGFuZGxlcjogKCkgPT4gUHJvbWlzZTxUPixcbiAgbG9nZ2VyPzogU3RydWN0dXJlZExvZ2dlclxuKTogUHJvbWlzZTxUPiA9PiB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGF3YWl0IGhhbmRsZXIoKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dnZXI/LmVycm9yKCdFcnJvciBpbiBoYW5kbGVyJywgeyBlcnJvcjogKGVycm9yIGFzIEVycm9yKS5tZXNzYWdlIH0pO1xuICAgIFxuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEdhbWVFbmdpbmVFcnJvcikge1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICAgIFxuICAgIC8vIENvbnZlcnQgdW5rbm93biBlcnJvcnMgdG8gR2FtZUVuZ2luZUVycm9yXG4gICAgdGhyb3cgbmV3IEdhbWVFbmdpbmVFcnJvcihcbiAgICAgIChlcnJvciBhcyBFcnJvcikubWVzc2FnZSB8fCAnSW50ZXJuYWwgc2VydmVyIGVycm9yJyxcbiAgICAgICdJTlRFUk5BTF9FUlJPUicsXG4gICAgICB7IG9yaWdpbmFsRXJyb3I6IGVycm9yIH1cbiAgICApO1xuICB9XG59O1xuXG4vLyBNb2NrIHZhbGlkYXRlUmVxdWVzdFxuZXhwb3J0IGNvbnN0IHZhbGlkYXRlUmVxdWVzdCA9IGFzeW5jIDxUPihcbiAgc2NoZW1hOiB7IHBhcnNlOiAoZGF0YTogdW5rbm93bikgPT4gVCB9LFxuICBib2R5OiBzdHJpbmcgfCBudWxsXG4pOiBQcm9taXNlPFQ+ID0+IHtcbiAgaWYgKCFib2R5KSB7XG4gICAgdGhyb3cgbmV3IEdhbWVFbmdpbmVFcnJvcignUmVxdWVzdCBib2R5IGlzIHJlcXVpcmVkJywgJ1ZBTElEQVRJT05fRVJST1InKTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShib2R5KTtcbiAgICByZXR1cm4gc2NoZW1hLnBhcnNlKHBhcnNlZCk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgdGhyb3cgbmV3IEdhbWVFbmdpbmVFcnJvcignSW52YWxpZCByZXF1ZXN0IGZvcm1hdCcsICdWQUxJREFUSU9OX0VSUk9SJywgeyBlcnJvcjogKGVycm9yIGFzIEVycm9yKS5tZXNzYWdlIH0pO1xuICB9XG59O1xuXG4vLyBNb2NrIHB1Ymxpc2hDdXN0b21NZXRyaWNcbmV4cG9ydCBjb25zdCBwdWJsaXNoQ3VzdG9tTWV0cmljID0gYXN5bmMgKFxuICBuYW1lc3BhY2U6IHN0cmluZyxcbiAgbWV0cmljTmFtZTogc3RyaW5nLFxuICB2YWx1ZTogbnVtYmVyLFxuICBkaW1lbnNpb25zPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPlxuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGNvbnNvbGUubG9nKGBbTUVUUklDXSAke25hbWVzcGFjZX0vJHttZXRyaWNOYW1lfTogJHt2YWx1ZX1gLCBkaW1lbnNpb25zIHx8ICcnKTtcbn07XG5cbi8vIE1vY2sgY29uZmlndXJhdGlvbiB0eXBlc1xuZXhwb3J0IGludGVyZmFjZSBHYW1lQmFzZVNlcnZpY2VDb25maWcge1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xuICByZWdpb246IHN0cmluZztcbiAgY29zdHM6IHtcbiAgICBlbmFibGVDb3N0QWxlcnRzOiBib29sZWFuO1xuICAgIG1vbnRobHlCdWRnZXRVc2Q6IG51bWJlcjtcbiAgfTtcbiAgbW9uaXRvcmluZzoge1xuICAgIGFsYXJtVGhyZXNob2xkczoge1xuICAgICAgZXJyb3JSYXRlOiBudW1iZXI7XG4gICAgICBsYXRlbmN5TXM6IG51bWJlcjtcbiAgICB9O1xuICB9O1xufVxuXG4vLyBNb2NrIGNyZWF0ZUNvbmZpZ0Zyb21FbnZpcm9ubWVudFxuZXhwb3J0IGNvbnN0IGNyZWF0ZUNvbmZpZ0Zyb21FbnZpcm9ubWVudCA9IChlbnZpcm9ubWVudD86IHN0cmluZyk6IEdhbWVCYXNlU2VydmljZUNvbmZpZyA9PiB7XG4gIGNvbnN0IGVudiA9IGVudmlyb25tZW50IHx8IHByb2Nlc3MuZW52LkVOVklST05NRU5UIHx8ICdkZXZlbG9wbWVudCc7XG4gIFxuICByZXR1cm4ge1xuICAgIGVudmlyb25tZW50OiBlbnYsXG4gICAgcmVnaW9uOiBwcm9jZXNzLmVudi5BV1NfUkVHSU9OIHx8ICdldS1ub3J0aC0xJyxcbiAgICBjb3N0czoge1xuICAgICAgZW5hYmxlQ29zdEFsZXJ0czogZW52ID09PSAncHJvZHVjdGlvbicsXG4gICAgICBtb250aGx5QnVkZ2V0VXNkOiBlbnYgPT09ICdwcm9kdWN0aW9uJyA/IDEwMDAgOiBlbnYgPT09ICdxYScgPyAyMDAgOiAxMDBcbiAgICB9LFxuICAgIG1vbml0b3Jpbmc6IHtcbiAgICAgIGFsYXJtVGhyZXNob2xkczoge1xuICAgICAgICBlcnJvclJhdGU6IGVudiA9PT0gJ3Byb2R1Y3Rpb24nID8gNSA6IDEwLFxuICAgICAgICBsYXRlbmN5TXM6IGVudiA9PT0gJ3Byb2R1Y3Rpb24nID8gMTAwMCA6IDMwMDBcbiAgICAgIH1cbiAgICB9XG4gIH07XG59O1xuXG4vLyBNb2NrIENESyBjb25zdHJ1Y3RzXG5leHBvcnQgY2xhc3MgTW9ja0xvZ2dpbmdDb25zdHJ1Y3QgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgbG9nR3JvdXA6IGxvZ3MuTG9nR3JvdXA7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG4gICAgXG4gICAgdGhpcy5sb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdMb2dHcm91cCcsIHtcbiAgICAgIHJldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWVxuICAgIH0pO1xuICB9XG59Il19