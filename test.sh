#!/bin/bash

# Comprehensive testing script for Evolving The Machine
# Provides easy access to different testing scenarios

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to run tests with coverage
run_tests_with_coverage() {
    print_status "Running tests with coverage..."
    npm test -- --coverage --passWithNoTests
}

# Function to run specific test categories
run_test_category() {
    local category=$1
    print_status "Running $category tests..."
    
    case $category in
        "unit")
            npm test -- --testNamePattern="unit|Unit" --coverage
            ;;
        "integration")
            npm test -- --testNamePattern="integration|Integration" --coverage
            ;;
        "mobile")
            npm test -- --testNamePattern="mobile|Mobile" --coverage
            ;;
        "all")
            npm test -- --coverage --passWithNoTests
            ;;
        *)
            print_error "Unknown test category: $category"
            print_status "Available categories: unit, integration, mobile, all"
            exit 1
            ;;
    esac
}

# Function to run performance tests
run_performance_tests() {
    print_status "Running performance tests..."
    npm test -- --testNamePattern="performance|Performance" --verbose
}

# Function to run mobile-specific tests
run_mobile_tests() {
    print_status "Running mobile-specific tests..."
    npm test -- --testNamePattern="mobile|Mobile|touch|Touch" --verbose
}

# Function to run tests in watch mode
run_watch_mode() {
    print_status "Running tests in watch mode..."
    npm test -- --watch
}

# Function to run tests with verbose output
run_verbose_tests() {
    print_status "Running tests with verbose output..."
    npm test -- --verbose --coverage
}

# Function to generate test report
generate_test_report() {
    print_status "Generating comprehensive test report..."
    
    # Run all tests with coverage
    npm test -- --coverage --passWithNoTests --json --outputFile=test-results.json
    
    # Generate HTML report
    if [ -f "coverage/lcov-report/index.html" ]; then
        print_success "Coverage report generated at: coverage/lcov-report/index.html"
    fi
    
    # Generate summary
    if [ -f "test-results.json" ]; then
        print_success "Test results saved to: test-results.json"
    fi
}

# Function to run linting
run_linting() {
    print_status "Running ESLint..."
    npm run lint
    
    if [ $? -eq 0 ]; then
        print_success "Linting passed!"
    else
        print_error "Linting failed!"
        exit 1
    fi
}

# Function to run type checking
run_type_check() {
    print_status "Running TypeScript type checking..."
    npx tsc --noEmit
    
    if [ $? -eq 0 ]; then
        print_success "Type checking passed!"
    else
        print_error "Type checking failed!"
        exit 1
    fi
}

# Function to run full CI pipeline
run_ci_pipeline() {
    print_status "Running full CI pipeline..."
    
    print_status "Step 1: Linting..."
    run_linting
    
    print_status "Step 2: Type checking..."
    run_type_check
    
    print_status "Step 3: Unit tests..."
    run_test_category "unit"
    
    print_status "Step 4: Integration tests..."
    run_test_category "integration"
    
    print_status "Step 5: Mobile tests..."
    run_test_category "mobile"
    
    print_status "Step 6: Performance tests..."
    run_performance_tests
    
    print_success "CI pipeline completed successfully!"
}

# Function to show help
show_help() {
    echo "Evolving The Machine - Testing Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  unit              Run unit tests only"
    echo "  integration       Run integration tests only"
    echo "  mobile            Run mobile-specific tests only"
    echo "  all               Run all tests"
    echo "  performance       Run performance tests"
    echo "  watch             Run tests in watch mode"
    echo "  verbose           Run tests with verbose output"
    echo "  coverage          Run tests with coverage report"
    echo "  report            Generate comprehensive test report"
    echo "  lint              Run ESLint"
    echo "  typecheck         Run TypeScript type checking"
    echo "  ci                Run full CI pipeline"
    echo "  help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 unit           # Run only unit tests"
    echo "  $0 mobile         # Run only mobile tests"
    echo "  $0 ci             # Run full CI pipeline"
    echo "  $0 watch          # Run tests in watch mode"
}

# Main script logic
case "${1:-help}" in
    "unit")
        run_test_category "unit"
        ;;
    "integration")
        run_test_category "integration"
        ;;
    "mobile")
        run_test_category "mobile"
        ;;
    "all")
        run_test_category "all"
        ;;
    "performance")
        run_performance_tests
        ;;
    "watch")
        run_watch_mode
        ;;
    "verbose")
        run_verbose_tests
        ;;
    "coverage")
        run_tests_with_coverage
        ;;
    "report")
        generate_test_report
        ;;
    "lint")
        run_linting
        ;;
    "typecheck")
        run_type_check
        ;;
    "ci")
        run_ci_pipeline
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
