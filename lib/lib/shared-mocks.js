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
        console.log(`[INFO] ${this.context}: ${message}`, details || '');
    }
    warn(message, details) {
        console.warn(`[WARN] ${this.context}: ${message}`, details || '');
    }
    error(message, details) {
        console.error(`[ERROR] ${this.context}: ${message}`, details || '');
    }
    debug(message, details) {
        if (process.env.NODE_ENV === 'development') {
            console.debug(`[DEBUG] ${this.context}: ${message}`, details || '');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhcmVkLW1vY2tzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc2hhcmVkLW1vY2tzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O0dBR0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDJEQUE2QztBQUM3QyxpREFBbUM7QUFDbkMsMkNBQXVDO0FBRXZDLHdCQUF3QjtBQUN4QixNQUFhLGdCQUFnQjtJQUNuQixPQUFPLENBQVM7SUFFeEIsWUFBWSxPQUFlO1FBQ3pCLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO0lBQ3pCLENBQUM7SUFFRCxJQUFJLENBQUMsT0FBZSxFQUFFLE9BQWE7UUFDakMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLElBQUksQ0FBQyxPQUFPLEtBQUssT0FBTyxFQUFFLEVBQUUsT0FBTyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ25FLENBQUM7SUFFRCxJQUFJLENBQUMsT0FBZSxFQUFFLE9BQWE7UUFDakMsT0FBTyxDQUFDLElBQUksQ0FBQyxVQUFVLElBQUksQ0FBQyxPQUFPLEtBQUssT0FBTyxFQUFFLEVBQUUsT0FBTyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ3BFLENBQUM7SUFFRCxLQUFLLENBQUMsT0FBZSxFQUFFLE9BQWE7UUFDbEMsT0FBTyxDQUFDLEtBQUssQ0FBQyxXQUFXLElBQUksQ0FBQyxPQUFPLEtBQUssT0FBTyxFQUFFLEVBQUUsT0FBTyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ3RFLENBQUM7SUFFRCxLQUFLLENBQUMsT0FBZSxFQUFFLE9BQWE7UUFDbEMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsS0FBSyxhQUFhLEVBQUUsQ0FBQztZQUMzQyxPQUFPLENBQUMsS0FBSyxDQUFDLFdBQVcsSUFBSSxDQUFDLE9BQU8sS0FBSyxPQUFPLEVBQUUsRUFBRSxPQUFPLElBQUksRUFBRSxDQUFDLENBQUM7UUFDdEUsQ0FBQztJQUNILENBQUM7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LENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUc7U0FDekU7UUFDRCxVQUFVLEVBQUU7WUFDVixlQUFlLEVBQUU7Z0JBQ2YsU0FBUyxFQUFFLEdBQUcsS0FBSyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtnQkFDeEMsU0FBUyxFQUFFLEdBQUcsS0FBSyxZQUFZLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSTthQUM5QztTQUNGO0tBQ0YsQ0FBQztBQUNKLENBQUMsQ0FBQztBQWpCVyxRQUFBLDJCQUEyQiwrQkFpQnRDO0FBRUYsc0JBQXNCO0FBQ3RCLE1BQWEsb0JBQXFCLFNBQVEsc0JBQVM7SUFDakMsUUFBUSxDQUFnQjtJQUV4QyxZQUFZLEtBQWdCLEVBQUUsRUFBVTtRQUN0QyxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUU7WUFDbEQsU0FBUyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUTtZQUN0QyxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1NBQ3pDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQVhELG9EQVdDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUZW1wb3JhcnkgbW9jayBpbXBsZW1lbnRhdGlvbnMgZm9yIHNoYXJlZCBsaWJyYXJpZXNcbiAqIFRoaXMgYWxsb3dzIHRlc3RpbmcgYW5kIGRldmVsb3BtZW50IHdoZW4gc2hhcmVkIHBhY2thZ2VzIGFyZSBub3QgYXZhaWxhYmxlXG4gKi9cblxuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbi8vIE1vY2sgU3RydWN0dXJlZExvZ2dlclxuZXhwb3J0IGNsYXNzIFN0cnVjdHVyZWRMb2dnZXIge1xuICBwcml2YXRlIGNvbnRleHQ6IHN0cmluZztcblxuICBjb25zdHJ1Y3Rvcihjb250ZXh0OiBzdHJpbmcpIHtcbiAgICB0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuICB9XG5cbiAgaW5mbyhtZXNzYWdlOiBzdHJpbmcsIGRldGFpbHM/OiBhbnkpOiB2b2lkIHtcbiAgICBjb25zb2xlLmxvZyhgW0lORk9dICR7dGhpcy5jb250ZXh0fTogJHttZXNzYWdlfWAsIGRldGFpbHMgfHwgJycpO1xuICB9XG5cbiAgd2FybihtZXNzYWdlOiBzdHJpbmcsIGRldGFpbHM/OiBhbnkpOiB2b2lkIHtcbiAgICBjb25zb2xlLndhcm4oYFtXQVJOXSAke3RoaXMuY29udGV4dH06ICR7bWVzc2FnZX1gLCBkZXRhaWxzIHx8ICcnKTtcbiAgfVxuXG4gIGVycm9yKG1lc3NhZ2U6IHN0cmluZywgZGV0YWlscz86IGFueSk6IHZvaWQge1xuICAgIGNvbnNvbGUuZXJyb3IoYFtFUlJPUl0gJHt0aGlzLmNvbnRleHR9OiAke21lc3NhZ2V9YCwgZGV0YWlscyB8fCAnJyk7XG4gIH1cblxuICBkZWJ1ZyhtZXNzYWdlOiBzdHJpbmcsIGRldGFpbHM/OiBhbnkpOiB2b2lkIHtcbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcpIHtcbiAgICAgIGNvbnNvbGUuZGVidWcoYFtERUJVR10gJHt0aGlzLmNvbnRleHR9OiAke21lc3NhZ2V9YCwgZGV0YWlscyB8fCAnJyk7XG4gICAgfVxuICB9XG59XG5cbi8vIE1vY2sgR2FtZUVuZ2luZUVycm9yXG5leHBvcnQgY2xhc3MgR2FtZUVuZ2luZUVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBwdWJsaWMgcmVhZG9ubHkgY29kZTogc3RyaW5nO1xuICBwdWJsaWMgcmVhZG9ubHkgZGV0YWlscz86IGFueTtcblxuICBjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcsIGNvZGU6IHN0cmluZywgZGV0YWlscz86IGFueSkge1xuICAgIHN1cGVyKG1lc3NhZ2UpO1xuICAgIHRoaXMubmFtZSA9ICdHYW1lRW5naW5lRXJyb3InO1xuICAgIHRoaXMuY29kZSA9IGNvZGU7XG4gICAgdGhpcy5kZXRhaWxzID0gZGV0YWlscztcbiAgfVxufVxuXG4vLyBNb2NrIHdpdGhFcnJvckhhbmRsaW5nXG5leHBvcnQgY29uc3Qgd2l0aEVycm9ySGFuZGxpbmcgPSBhc3luYyA8VD4oXG4gIGhhbmRsZXI6ICgpID0+IFByb21pc2U8VD4sXG4gIGxvZ2dlcj86IFN0cnVjdHVyZWRMb2dnZXJcbik6IFByb21pc2U8VD4gPT4ge1xuICB0cnkge1xuICAgIHJldHVybiBhd2FpdCBoYW5kbGVyKCk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgbG9nZ2VyPy5lcnJvcignRXJyb3IgaW4gaGFuZGxlcicsIHsgZXJyb3I6IChlcnJvciBhcyBFcnJvcikubWVzc2FnZSB9KTtcbiAgICBcbiAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBHYW1lRW5naW5lRXJyb3IpIHtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgICBcbiAgICAvLyBDb252ZXJ0IHVua25vd24gZXJyb3JzIHRvIEdhbWVFbmdpbmVFcnJvclxuICAgIHRocm93IG5ldyBHYW1lRW5naW5lRXJyb3IoXG4gICAgICAoZXJyb3IgYXMgRXJyb3IpLm1lc3NhZ2UgfHwgJ0ludGVybmFsIHNlcnZlciBlcnJvcicsXG4gICAgICAnSU5URVJOQUxfRVJST1InLFxuICAgICAgeyBvcmlnaW5hbEVycm9yOiBlcnJvciB9XG4gICAgKTtcbiAgfVxufTtcblxuLy8gTW9jayB2YWxpZGF0ZVJlcXVlc3RcbmV4cG9ydCBjb25zdCB2YWxpZGF0ZVJlcXVlc3QgPSBhc3luYyA8VD4oXG4gIHNjaGVtYTogYW55LFxuICBib2R5OiBzdHJpbmcgfCBudWxsXG4pOiBQcm9taXNlPFQ+ID0+IHtcbiAgaWYgKCFib2R5KSB7XG4gICAgdGhyb3cgbmV3IEdhbWVFbmdpbmVFcnJvcignUmVxdWVzdCBib2R5IGlzIHJlcXVpcmVkJywgJ1ZBTElEQVRJT05fRVJST1InKTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShib2R5KTtcbiAgICByZXR1cm4gc2NoZW1hLnBhcnNlKHBhcnNlZCkgYXMgVDtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICB0aHJvdyBuZXcgR2FtZUVuZ2luZUVycm9yKCdJbnZhbGlkIHJlcXVlc3QgZm9ybWF0JywgJ1ZBTElEQVRJT05fRVJST1InLCB7IGVycm9yOiAoZXJyb3IgYXMgRXJyb3IpLm1lc3NhZ2UgfSk7XG4gIH1cbn07XG5cbi8vIE1vY2sgcHVibGlzaEN1c3RvbU1ldHJpY1xuZXhwb3J0IGNvbnN0IHB1Ymxpc2hDdXN0b21NZXRyaWMgPSBhc3luYyAoXG4gIG5hbWVzcGFjZTogc3RyaW5nLFxuICBtZXRyaWNOYW1lOiBzdHJpbmcsXG4gIHZhbHVlOiBudW1iZXIsXG4gIGRpbWVuc2lvbnM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+XG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgY29uc29sZS5sb2coYFtNRVRSSUNdICR7bmFtZXNwYWNlfS8ke21ldHJpY05hbWV9OiAke3ZhbHVlfWAsIGRpbWVuc2lvbnMgfHwgJycpO1xufTtcblxuLy8gTW9jayBjb25maWd1cmF0aW9uIHR5cGVzXG5leHBvcnQgaW50ZXJmYWNlIEdhbWVCYXNlU2VydmljZUNvbmZpZyB7XG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG4gIHJlZ2lvbjogc3RyaW5nO1xuICBjb3N0czoge1xuICAgIGVuYWJsZUNvc3RBbGVydHM6IGJvb2xlYW47XG4gICAgbW9udGhseUJ1ZGdldFVzZDogbnVtYmVyO1xuICB9O1xuICBtb25pdG9yaW5nOiB7XG4gICAgYWxhcm1UaHJlc2hvbGRzOiB7XG4gICAgICBlcnJvclJhdGU6IG51bWJlcjtcbiAgICAgIGxhdGVuY3lNczogbnVtYmVyO1xuICAgIH07XG4gIH07XG59XG5cbi8vIE1vY2sgY3JlYXRlQ29uZmlnRnJvbUVudmlyb25tZW50XG5leHBvcnQgY29uc3QgY3JlYXRlQ29uZmlnRnJvbUVudmlyb25tZW50ID0gKGVudmlyb25tZW50Pzogc3RyaW5nKTogR2FtZUJhc2VTZXJ2aWNlQ29uZmlnID0+IHtcbiAgY29uc3QgZW52ID0gZW52aXJvbm1lbnQgfHwgcHJvY2Vzcy5lbnYuRU5WSVJPTk1FTlQgfHwgJ2RldmVsb3BtZW50JztcbiAgXG4gIHJldHVybiB7XG4gICAgZW52aXJvbm1lbnQ6IGVudixcbiAgICByZWdpb246IHByb2Nlc3MuZW52LkFXU19SRUdJT04gfHwgJ2V1LW5vcnRoLTEnLFxuICAgIGNvc3RzOiB7XG4gICAgICBlbmFibGVDb3N0QWxlcnRzOiBlbnYgPT09ICdwcm9kdWN0aW9uJyxcbiAgICAgIG1vbnRobHlCdWRnZXRVc2Q6IGVudiA9PT0gJ3Byb2R1Y3Rpb24nID8gMTAwMCA6IGVudiA9PT0gJ3FhJyA/IDIwMCA6IDEwMFxuICAgIH0sXG4gICAgbW9uaXRvcmluZzoge1xuICAgICAgYWxhcm1UaHJlc2hvbGRzOiB7XG4gICAgICAgIGVycm9yUmF0ZTogZW52ID09PSAncHJvZHVjdGlvbicgPyA1IDogMTAsXG4gICAgICAgIGxhdGVuY3lNczogZW52ID09PSAncHJvZHVjdGlvbicgPyAxMDAwIDogMzAwMFxuICAgICAgfVxuICAgIH1cbiAgfTtcbn07XG5cbi8vIE1vY2sgQ0RLIGNvbnN0cnVjdHNcbmV4cG9ydCBjbGFzcyBNb2NrTG9nZ2luZ0NvbnN0cnVjdCBleHRlbmRzIENvbnN0cnVjdCB7XG4gIHB1YmxpYyByZWFkb25seSBsb2dHcm91cDogbG9ncy5Mb2dHcm91cDtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcbiAgICBcbiAgICB0aGlzLmxvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0xvZ0dyb3VwJywge1xuICAgICAgcmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZXG4gICAgfSk7XG4gIH1cbn0iXX0=