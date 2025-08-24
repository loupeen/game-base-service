import { GlobalSetup } from '@jest/types';

const setup: GlobalSetup = async () => {
  console.log('🧪 Setting up global test environment...');
  
  // Set global test environment variables
  process.env.TEST_TIMEOUT = '60000';
  process.env.AWS_REGION = 'eu-north-1';
  process.env.CDK_DEFAULT_ACCOUNT = '728427470046';
  
  // Integration test configuration
  if (process.env.TEST_ENV === 'integration') {
    console.log('🔧 Configuring integration test environment...');
    
    // Validate required AWS credentials for integration tests
    if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_PROFILE) {
      console.warn('⚠️  No AWS credentials found - integration tests may fail');
    }
    
    // Set longer timeouts for integration tests
    process.env.TEST_TIMEOUT = '120000';
  }
  
  console.log('✅ Global test setup complete');
};

export default setup;