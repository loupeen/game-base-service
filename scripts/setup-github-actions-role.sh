#!/bin/bash

# Setup GitHub Actions Role for game-base-service
# Following platform standards from CLAUDE.md

set -e

echo "🔧 Setting up GitHub Actions IAM role for game-base-service..."

# Test Environment (Account: 728427470046)
echo "Setting up Test environment role..."
aws iam create-role \
  --role-name GitHubActionsRole-GameBaseService \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Federated": "arn:aws:iam::728427470046:oidc-provider/token.actions.githubusercontent.com"
        },
        "Action": "sts:AssumeRoleWithWebIdentity",
        "Condition": {
          "StringLike": {
            "token.actions.githubusercontent.com:sub": "repo:loupeen/game-base-service:*"
          }
        }
      }
    ]
  }' \
  --profile AWSAdministratorAccess-728427470046 || echo "Role may already exist"

# Attach CDK deployment permissions
aws iam attach-role-policy \
  --role-name GitHubActionsRole-GameBaseService \
  --policy-arn arn:aws:iam::aws:policy/PowerUserAccess \
  --profile AWSAdministratorAccess-728427470046

echo "✅ GitHub Actions role setup complete"
echo "Role ARN: arn:aws:iam::728427470046:role/GitHubActionsRole-GameBaseService"

# QA Environment (Account: 077029784291) 
echo "Setting up QA environment role..."
aws iam create-role \
  --role-name GitHubActionsRole-GameBaseService \
  --assume-role-policy-document '{
    "Version": "2012-10-17", 
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Federated": "arn:aws:iam::077029784291:oidc-provider/token.actions.githubusercontent.com"
        },
        "Action": "sts:AssumeRoleWithWebIdentity",
        "Condition": {
          "StringLike": {
            "token.actions.githubusercontent.com:sub": "repo:loupeen/game-base-service:*"
          }
        }
      }
    ]
  }' \
  --profile AWSAdministratorAccess-077029784291 || echo "Role may already exist"

# Attach CDK deployment permissions  
aws iam attach-role-policy \
  --role-name GitHubActionsRole-GameBaseService \
  --policy-arn arn:aws:iam::aws:policy/PowerUserAccess \
  --profile AWSAdministratorAccess-077029784291

echo "✅ QA GitHub Actions role setup complete"
echo "Role ARN: arn:aws:iam::077029784291:role/GitHubActionsRole-GameBaseService"