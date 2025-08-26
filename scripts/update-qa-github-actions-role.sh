#!/bin/bash

# Update GitHub Actions OIDC IAM Role trust policy in QA account to include game-base-service
# Run this script in the GameQA account (077029784291)

set -e

ACCOUNT_ID="077029784291"
ROLE_NAME="GitHubActionsDeploymentRole"
AWS_PROFILE="AWSAdministratorAccess-077029784291"

echo "🔧 Updating GitHub Actions IAM Role trust policy in QA account to include game-base-service..."

# Create updated trust policy for both repositories
cat > updated-trust-policy-qa.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Federated": "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
            },
            "Action": "sts:AssumeRoleWithWebIdentity",
            "Condition": {
                "StringEquals": {
                    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
                },
                "StringLike": {
                    "token.actions.githubusercontent.com:sub": [
                        "repo:loupeen/game-auth-service:ref:refs/heads/main",
                        "repo:loupeen/game-auth-service:environment:test",
                        "repo:loupeen/game-auth-service:environment:qa",
                        "repo:loupeen/game-base-service:ref:refs/heads/main",
                        "repo:loupeen/game-base-service:environment:test",
                        "repo:loupeen/game-base-service:environment:qa",
                        "repo:loupeen/game-base-service:*"
                    ]
                }
            }
        }
    ]
}
EOF

echo "📝 Updating IAM role trust policy in QA account..."
aws iam update-assume-role-policy \
    --role-name ${ROLE_NAME} \
    --policy-document file://updated-trust-policy-qa.json \
    --profile ${AWS_PROFILE}

echo "✅ Trust policy updated successfully in QA account!"
echo ""
echo "🔍 Verifying trust policy..."
aws iam get-role \
    --role-name ${ROLE_NAME} \
    --profile ${AWS_PROFILE} \
    --query 'Role.AssumeRolePolicyDocument' \
    --output json

echo ""
echo "🧹 Cleaning up temporary files..."
rm -f updated-trust-policy-qa.json

echo ""
echo "✅ QA account update complete!"
echo "The role ${ROLE_NAME} in account ${ACCOUNT_ID} now trusts both repositories:"
echo "  - game-auth-service"
echo "  - game-base-service"