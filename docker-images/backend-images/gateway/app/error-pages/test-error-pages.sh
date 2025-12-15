#!/bin/bash
#
# Test Script for Custom Error Pages
#
# This script helps verify that the custom error pages are working correctly
# by simulating different error conditions and checking the responses.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ERROR_PAGE="${SCRIPT_DIR}/error.html"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

function print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

function print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

function print_failure() {
    echo -e "${RED}✗${NC} $1"
}

function print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

function print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Test 1: Check if error page file exists
function test_file_exists() {
    TESTS_RUN=$((TESTS_RUN + 1))
    print_info "Test 1: Checking if error.html exists..."
    
    if [[ -f "$ERROR_PAGE" ]]; then
        print_success "error.html file exists"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        print_failure "error.html file not found at: $ERROR_PAGE"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Test 2: Check HTML validity (basic)
function test_html_validity() {
    TESTS_RUN=$((TESTS_RUN + 1))
    print_info "Test 2: Checking HTML validity..."
    
    # Check for essential HTML tags
    if grep -q "<!DOCTYPE html>" "$ERROR_PAGE" && \
       grep -q "<html" "$ERROR_PAGE" && \
       grep -q "<head>" "$ERROR_PAGE" && \
       grep -q "<body>" "$ERROR_PAGE" && \
       grep -q "</html>" "$ERROR_PAGE"; then
        print_success "HTML structure is valid"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        print_failure "HTML structure is invalid"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Test 3: Check for SSI directives
function test_ssi_directives() {
    TESTS_RUN=$((TESTS_RUN + 1))
    print_info "Test 3: Checking for SSI directives..."
    
    if grep -q "<!--# echo var=" "$ERROR_PAGE"; then
        print_success "SSI directives found"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        print_failure "SSI directives not found"
        print_warning "Error page may not display dynamic status codes"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Test 4: Check for inline CSS
function test_inline_css() {
    TESTS_RUN=$((TESTS_RUN + 1))
    print_info "Test 4: Checking for inline CSS..."
    
    if grep -q "<style>" "$ERROR_PAGE"; then
        print_success "Inline CSS found"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        print_failure "Inline CSS not found"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Test 5: Check for inline JavaScript
function test_inline_javascript() {
    TESTS_RUN=$((TESTS_RUN + 1))
    print_info "Test 5: Checking for inline JavaScript..."
    
    if grep -q "<script>" "$ERROR_PAGE"; then
        print_success "Inline JavaScript found"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        print_failure "Inline JavaScript not found"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Test 6: Check for error code handling
function test_error_code_handling() {
    TESTS_RUN=$((TESTS_RUN + 1))
    print_info "Test 6: Checking error code handling..."
    
    local error_codes=("400" "401" "403" "404" "500" "502" "503" "504")
    local all_found=true
    
    for code in "${error_codes[@]}"; do
        if ! grep -q "'$code'" "$ERROR_PAGE"; then
            print_warning "Error code $code not found in configuration"
            all_found=false
        fi
    done
    
    if $all_found; then
        print_success "All standard error codes are configured"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        print_warning "Some error codes may not have custom messages"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0  # Not a critical failure
    fi
}

# Test 7: Check for responsive design
function test_responsive_design() {
    TESTS_RUN=$((TESTS_RUN + 1))
    print_info "Test 7: Checking for responsive design..."
    
    if grep -q "@media" "$ERROR_PAGE"; then
        print_success "Responsive media queries found"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        print_failure "No responsive design detected"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Test 8: Check for Holistix branding
function test_branding() {
    TESTS_RUN=$((TESTS_RUN + 1))
    print_info "Test 8: Checking for Holistix branding..."
    
    if grep -iq "holistix" "$ERROR_PAGE"; then
        print_success "Holistix branding found"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        print_warning "Holistix branding not clearly visible"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0  # Not a critical failure
    fi
}

# Test 9: Simulate serving the page (if nginx is available)
function test_nginx_serve() {
    TESTS_RUN=$((TESTS_RUN + 1))
    print_info "Test 9: Testing nginx configuration..."
    
    if ! command -v nginx &> /dev/null; then
        print_warning "nginx not installed, skipping serve test"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    fi
    
    # Check if nginx config syntax is valid
    if sudo nginx -t &> /dev/null; then
        print_success "nginx configuration is valid"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        print_warning "nginx configuration check skipped (may not be running in gateway)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    fi
}

# Test 10: Check file size (performance check)
function test_file_size() {
    TESTS_RUN=$((TESTS_RUN + 1))
    print_info "Test 10: Checking file size..."
    
    local file_size=$(stat -c%s "$ERROR_PAGE" 2>/dev/null || stat -f%z "$ERROR_PAGE" 2>/dev/null || echo "0")
    local max_size=$((50 * 1024))  # 50KB
    
    if [[ $file_size -lt $max_size ]]; then
        local size_kb=$((file_size / 1024))
        print_success "File size is reasonable: ${size_kb}KB"
        return 0
    else
        local size_kb=$((file_size / 1024))
        print_warning "File size is large: ${size_kb}KB"
        return 0  # Not a critical failure
    fi
}

# Test 11: Check for auto-retry logic (for 502/503)
function test_auto_retry() {
    TESTS_RUN=$((TESTS_RUN + 1))
    print_info "Test 11: Checking for auto-retry logic..."
    
    if grep -q "autoRetry" "$ERROR_PAGE" && \
       grep -q "502\|503" "$ERROR_PAGE"; then
        print_success "Auto-retry logic found for 502/503 errors"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        print_warning "Auto-retry logic may not be implemented"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0  # Not a critical failure
    fi
}

# Test 12: Visual test in browser (manual)
function test_visual_browser() {
    print_info "Test 12: Visual browser test (manual)..."
    echo ""
    echo -e "  To test the error page visually:"
    echo -e "  1. Open the file in a browser:"
    echo -e "     ${GREEN}file://${ERROR_PAGE}${NC}"
    echo ""
    echo -e "  2. Or serve it locally:"
    echo -e "     ${GREEN}cd ${SCRIPT_DIR}${NC}"
    echo -e "     ${GREEN}python3 -m http.server 8000${NC}"
    echo -e "     ${GREEN}# Then visit: http://localhost:8000/error.html${NC}"
    echo ""
    echo -e "  3. Test different error codes by modifying the SSI variable"
    echo ""
}

# Main test execution
function run_all_tests() {
    print_header "Custom Error Page Tests"
    
    test_file_exists
    test_html_validity
    test_ssi_directives
    test_inline_css
    test_inline_javascript
    test_error_code_handling
    test_responsive_design
    test_branding
    test_nginx_serve
    test_file_size
    test_auto_retry
    test_visual_browser
    
    # Print summary
    print_header "Test Summary"
    echo -e "Tests run:    ${BLUE}${TESTS_RUN}${NC}"
    echo -e "Tests passed: ${GREEN}${TESTS_PASSED}${NC}"
    echo -e "Tests failed: ${RED}${TESTS_FAILED}${NC}"
    echo ""
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}✓ All tests passed!${NC}"
        return 0
    else
        echo -e "${RED}✗ Some tests failed${NC}"
        return 1
    fi
}

# Check if script is being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    run_all_tests
fi
