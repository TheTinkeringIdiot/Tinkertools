#!/bin/bash

# TinkerTools Interpolation Test Runner
# 
# Runs all unit and integration tests for the interpolation system

set -e

echo "🧪 Running TinkerTools Interpolation Tests"
echo "=========================================="

# Set environment variables
export DATABASE_URL=postgresql://aodbuser:password@localhost:5432/tinkertools

echo "📦 Backend Tests"
echo "----------------"

# Navigate to backend directory
cd backend

# Activate virtual environment
source venv/bin/activate

echo "🔧 Running interpolation service unit tests..."
python -m pytest app/tests/test_interpolation_service.py -v --tb=short

echo ""
echo "🌐 Running interpolation API endpoint tests..."
python -m pytest app/tests/test_interpolation_endpoints.py -v --tb=short

echo ""
echo "🔗 Running interpolation integration tests..."
python -m pytest app/tests/test_interpolation_integration.py -v --tb=short

echo ""
echo "📊 Running all interpolation tests with coverage..."
python -m pytest app/tests/test_interpolation*.py --cov=app.services.interpolation --cov=app.models.interpolated_item --cov-report=html --cov-report=term-missing

# Navigate back to project root
cd ..

echo ""
echo "🎨 Frontend Tests"
echo "-----------------"

# Navigate to frontend directory
cd frontend

echo "⚛️ Running frontend interpolation service tests..."
npm test -- src/services/__tests__/interpolation-service.test.ts

echo ""
echo "🎪 Running interpolation composable tests..."
npm test -- src/composables/__tests__/useInterpolation.test.ts

# Navigate back to project root
cd ..

echo ""
echo "✅ All interpolation tests completed!"
echo ""
echo "📈 Test Coverage Reports:"
echo "- Backend: backend/htmlcov/index.html"
echo "- Frontend: Check npm test output above"
echo ""
echo "🚀 To run individual test suites:"
echo "  Backend Service: cd backend && pytest app/tests/test_interpolation_service.py -v"
echo "  Backend API:     cd backend && pytest app/tests/test_interpolation_endpoints.py -v"
echo "  Backend Integration: cd backend && pytest app/tests/test_interpolation_integration.py -v"
echo "  Frontend Service: cd frontend && npm test src/services/__tests__/interpolation-service.test.ts"
echo "  Frontend Composable: cd frontend && npm test src/composables/__tests__/useInterpolation.test.ts"