#!/bin/bash

# Script to load Ground Truth data into MongoDB

echo "🔄 Loading Ground Truth for Permit documents..."

# Check if backend is running
if ! curl -s http://localhost:5000 > /dev/null 2>&1; then
    echo "❌ Backend is not running! Please start it first:"
    echo "   cd backend && npm start"
    exit 1
fi

# Upload Ground Truth
response=$(curl -s -X POST http://localhost:5000/api/gt/upload \
  -H "Content-Type: application/json" \
  -d @ground-truth-permit.json)

# Check if successful
if echo "$response" | grep -q '"success":true'; then
    count=$(echo "$response" | grep -o '"count":[0-9]*' | grep -o '[0-9]*')
    echo "✅ Ground Truth loaded successfully! ($count records)"
    echo ""
    echo "Now you can upload vendor ZIP files at http://localhost:3000"
else
    echo "❌ Failed to load Ground Truth:"
    echo "$response"
    exit 1
fi
