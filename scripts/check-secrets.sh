#!/bin/bash
#
# check-secrets.sh - Pre-commit hook to prevent committing secrets
#
# This script checks for common patterns that might indicate secrets
# are being committed to the repository.
#
# Usage:
#   ./scripts/check-secrets.sh
#   git config core.hooksPath scripts/  # To use as git hook
#

set -e

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Track if any secrets were found
SECRETS_FOUND=0

echo "🔍 Checking for secrets in staged files..."

# Check if any .env.claude files are being staged
if git diff --cached --name-only | grep -E '\.env\.claude' > /dev/null; then
    echo -e "${RED}❌ ERROR: .env.claude files should never be committed!${NC}"
    echo "   Found staged .env.claude files:"
    git diff --cached --name-only | grep -E '\.env\.claude' | sed 's/^/   - /'
    SECRETS_FOUND=1
fi

# Check for database URLs with real credentials
if git diff --cached | grep -E 'postgresql://.*:.*@.*tinkertools' > /dev/null; then
    echo -e "${RED}❌ ERROR: Database URL with credentials found in staged changes!${NC}"
    echo "   Please remove database URLs with real passwords from your code."
    SECRETS_FOUND=1
fi

# Check for hardcoded aodbuser password
if git diff --cached | grep -E 'aodbuser:password' > /dev/null; then
    echo -e "${RED}❌ ERROR: Hardcoded database credentials found!${NC}"
    echo "   Found 'aodbuser:password' in staged changes."
    SECRETS_FOUND=1
fi

# Check for staging of any .env files (except .env.example)
if git diff --cached --name-only | grep -E '^\.env' | grep -v '\.env\.example' > /dev/null; then
    echo -e "${YELLOW}⚠️  WARNING: .env files being committed:${NC}"
    git diff --cached --name-only | grep -E '^\.env' | grep -v '\.env\.example' | sed 's/^/   - /'
    echo "   Make sure these don't contain secrets!"
fi

# Check for backend/.env files (except .env.example)
if git diff --cached --name-only | grep -E '^backend/\.env' | grep -v '\.env\.example' > /dev/null; then
    echo -e "${YELLOW}⚠️  WARNING: backend/.env files being committed:${NC}"
    git diff --cached --name-only | grep -E '^backend/\.env' | grep -v '\.env\.example' | sed 's/^/   - /'
    echo "   Make sure these don't contain secrets!"
fi

# Final result
if [ $SECRETS_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ No secrets detected in staged files${NC}"
    exit 0
else
    echo -e "${RED}❌ Secrets detected! Please fix the issues above before committing.${NC}"
    echo ""
    echo "Common fixes:"
    echo "  - Remove .env.claude files from staging: git reset HEAD backend/.env.claude"
    echo "  - Use environment variables instead of hardcoded credentials"
    echo "  - Move sensitive config to .env.claude (which is gitignored)"
    echo ""
    exit 1
fi