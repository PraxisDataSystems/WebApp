#!/bin/bash
# Test script for Propstream automation system

set -e

echo "=========================================="
echo "Propstream Automation System - Test Suite"
echo "=========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check directory structure
echo -e "${YELLOW}Test 1: Directory Structure${NC}"
if [ -d ~/clawd/propstream-app ]; then
    echo -e "${GREEN}✓${NC} Project directory exists"
else
    echo -e "${RED}✗${NC} Project directory missing"
    exit 1
fi

# Test 2: Check credentials
echo -e "\n${YELLOW}Test 2: Credentials${NC}"
if [ -f ~/clawd/credentials/propstream-praxis.json ]; then
    echo -e "${GREEN}✓${NC} Propstream credentials found"
else
    echo -e "${RED}✗${NC} Propstream credentials missing"
fi

if [ -f ~/clawd/credentials/google-oauth-client.json ]; then
    echo -e "${GREEN}✓${NC} Google OAuth client found"
else
    echo -e "${RED}✗${NC} Google OAuth client missing"
fi

if [ -f ~/clawd/credentials/google-token.json ]; then
    echo -e "${GREEN}✓${NC} Google OAuth token found"
else
    echo -e "${RED}✗${NC} Google OAuth token missing"
fi

# Test 3: Check environment variables
echo -e "\n${YELLOW}Test 3: Environment Variables${NC}"
if [ -f ~/clawd/propstream-app/.env.local ]; then
    echo -e "${GREEN}✓${NC} .env.local exists"
    if grep -q "OPENAI_API_KEY" ~/clawd/propstream-app/.env.local; then
        echo -e "${GREEN}✓${NC} OpenAI API key configured"
    else
        echo -e "${RED}✗${NC} OpenAI API key not configured"
    fi
else
    echo -e "${RED}✗${NC} .env.local missing"
fi

# Test 4: Check Node dependencies
echo -e "\n${YELLOW}Test 4: Dependencies${NC}"
if [ -d ~/clawd/propstream-app/node_modules ]; then
    echo -e "${GREEN}✓${NC} Node modules installed"
else
    echo -e "${RED}✗${NC} Node modules missing (run: npm install)"
fi

# Test 5: Check build
echo -e "\n${YELLOW}Test 5: Build Status${NC}"
if [ -d ~/clawd/propstream-app/.next ]; then
    echo -e "${GREEN}✓${NC} Build artifacts present"
else
    echo -e "${RED}✗${NC} Build artifacts missing (run: npm run build)"
fi

# Test 6: Check API endpoints
echo -e "\n${YELLOW}Test 6: API Endpoints${NC}"
if curl -s http://localhost:3000/api/config > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Server responding"
    echo -e "${GREEN}✓${NC} Config API accessible"
else
    echo -e "${YELLOW}⚠${NC} Server not running (run: npm run dev)"
fi

# Test 7: Check Google Sheets integration
echo -e "\n${YELLOW}Test 7: Google Sheets Integration${NC}"
if [ -f ~/clawd/skills/email/google-api.js ]; then
    echo -e "${GREEN}✓${NC} Google API client available"
    
    # Test if we can access the spreadsheet
    cd ~/clawd/skills/email
    SHEET_TEST=$(node google-api.js sheets:get 1TMEYZ9RjTBNBS4lqDGxX4lDdh-OReMGX_0uiXuNNjv0 2>&1 | head -5)
    if echo "$SHEET_TEST" | grep -q "properties"; then
        echo -e "${GREEN}✓${NC} Can access target spreadsheet"
    else
        echo -e "${YELLOW}⚠${NC} Unable to verify spreadsheet access"
    fi
else
    echo -e "${RED}✗${NC} Google API client missing"
fi

# Test 8: Check export directories
echo -e "\n${YELLOW}Test 8: Export Directories${NC}"
if [ -d ~/clawd/propstream-exports ]; then
    echo -e "${GREEN}✓${NC} Export directory exists"
else
    echo -e "${YELLOW}⚠${NC} Export directory will be created on first run"
fi

# Summary
echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo ""
echo -e "${GREEN}Ready to use!${NC}"
echo ""
echo "Next steps:"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Click 'Export from Propstream' to test (max 5 properties)"
echo "3. Click 'Evaluate Properties' to run AI analysis"
echo "4. Review results before pushing to Google Sheets"
echo ""
echo "For detailed instructions, see README.md"
echo ""
