#!/bin/bash

API_URL="http://localhost:5000/api"

echo "==================================="
echo "Vendor Evaluation API Test Suite"
echo "==================================="
echo ""

# Test 1: Health Check
echo "Test 1: Health Check"
echo "--------------------"
HEALTH=$(curl -s $API_URL/health)
if echo "$HEALTH" | grep -q "Server is running"; then
    echo "✓ PASS - Server is healthy"
else
    echo "✗ FAIL - Server health check failed"
    exit 1
fi
echo ""

# Test 2: Upload Ground Truth
echo "Test 2: Upload Ground Truth"
echo "---------------------------"
GT_RESPONSE=$(curl -s -X POST $API_URL/gt/upload \
  -H "Content-Type: application/json" \
  -d @sample-data/ground-truth.json)
if echo "$GT_RESPONSE" | grep -q "Successfully uploaded"; then
    echo "✓ PASS - Ground truth uploaded"
else
    echo "✗ FAIL - Ground truth upload failed"
    echo "$GT_RESPONSE"
fi
echo ""

# Test 3: Verify Ground Truth
echo "Test 3: Verify Ground Truth"
echo "---------------------------"
GT_GET=$(curl -s $API_URL/gt)
GT_COUNT=$(echo "$GT_GET" | grep -o '"count":[0-9]*' | grep -o '[0-9]*')
echo "Found $GT_COUNT ground truth records"
if [ "$GT_COUNT" -gt 0 ]; then
    echo "✓ PASS - Ground truth records exist"
else
    echo "✗ FAIL - No ground truth records found"
fi
echo ""

# Test 4: Upload Vendor A
echo "Test 4: Upload Vendor A"
echo "-----------------------"
VA_RESPONSE=$(curl -s -X POST $API_URL/vendor/upload \
  -H "Content-Type: application/json" \
  -d @sample-data/vendor-a-submission.json)
if echo "$VA_RESPONSE" | grep -q "Vendor A"; then
    echo "✓ PASS - Vendor A uploaded"
else
    echo "✗ FAIL - Vendor A upload failed"
    echo "$VA_RESPONSE"
fi
echo ""

# Test 5: Upload Vendor B
echo "Test 5: Upload Vendor B"
echo "-----------------------"
VB_RESPONSE=$(curl -s -X POST $API_URL/vendor/upload \
  -H "Content-Type: application/json" \
  -d @sample-data/vendor-b-submission.json)
if echo "$VB_RESPONSE" | grep -q "Vendor B"; then
    echo "✓ PASS - Vendor B uploaded"
else
    echo "✗ FAIL - Vendor B upload failed"
    echo "$VB_RESPONSE"
fi
echo ""

# Test 6: Get Vendor Submissions
echo "Test 6: Get Vendor Submissions"
echo "-------------------------------"
SUBS=$(curl -s $API_URL/vendor/submissions)
VENDOR_COUNT=$(echo "$SUBS" | grep -o '"vendors":\[[^]]*\]' | grep -o "Vendor" | wc -l)
echo "Found $VENDOR_COUNT vendors"
if [ "$VENDOR_COUNT" -ge 2 ]; then
    echo "✓ PASS - Vendor submissions retrieved"
else
    echo "✗ FAIL - Expected at least 2 vendors"
fi
echo ""

# Test 7: Calculate Final Scores
echo "Test 7: Calculate Final Scores"
echo "-------------------------------"
CALC_RESPONSE=$(curl -s -X POST $API_URL/vendor/calculate-final)
if echo "$CALC_RESPONSE" | grep -q "calculated successfully"; then
    echo "✓ PASS - Scores calculated"
else
    echo "✗ FAIL - Score calculation failed"
    echo "$CALC_RESPONSE"
fi
echo ""

# Test 8: Get Results
echo "Test 8: Get Evaluation Results"
echo "-------------------------------"
RESULTS=$(curl -s $API_URL/vendor/results)
if echo "$RESULTS" | grep -q "rank"; then
    echo "✓ PASS - Results retrieved"
    echo ""
    echo "Results Summary:"
    echo "$RESULTS" | grep -o '"vendor_name":"[^"]*","document_type_scores":\[.*\],"overall_accuracy":[0-9]*,"overall_time_score":[0-9]*,"total_score":[0-9]*,"rank":[0-9]*' | head -5
else
    echo "✗ FAIL - Results retrieval failed"
fi
echo ""

# Test 9: Winner Verification
echo "Test 9: Winner Verification"
echo "---------------------------"
WINNER=$(echo "$RESULTS" | grep -o '"rank":1' -A 100 | grep -o '"vendor_name":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ ! -z "$WINNER" ]; then
    echo "✓ PASS - Winner identified: $WINNER"
else
    echo "✗ FAIL - Could not identify winner"
fi
echo ""

echo "==================================="
echo "Test Suite Complete"
echo "==================================="
