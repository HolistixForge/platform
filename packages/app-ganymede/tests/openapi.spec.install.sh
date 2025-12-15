#!/bin/bash

set -e 

TST_DIR=$NX_WORKSPACE_ROOT/packages/app-ganymede/tests

cd $TST_DIR

# Check if Python3 is installed
if ! command -v python3 &> /dev/null; then
    echo "Python3 not found. Installing..."
    
    # Detect OS and install Python accordingly
    if [ -f /etc/debian_version ]; then
        # Debian/Ubuntu
        echo "Installing Python3 and required packages..."
        sudo apt-get update -qq
        sudo apt-get install -y python3 python3-pip python3-venv
    elif [ -f /etc/redhat-release ]; then
        # RedHat/CentOS/Fedora
        sudo yum install -y python3 python3-pip
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install python3
        else
            echo "Homebrew not found. Please install Python3 manually."
            exit 1
        fi
    else
        echo "Unsupported OS. Please install Python3 manually."
        exit 1
    fi
    
    echo "Python3 installed successfully."
fi

# Verify Python is now available
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python3 installation failed or not in PATH"
    exit 1
fi

echo "Python3 version: $(python3 --version)"

# Check if python3-venv is available by trying to create a test venv
echo "Checking for python3-venv..."
TEST_VENV="/tmp/test-venv-$$"
if ! python3 -m venv "$TEST_VENV" 2>/dev/null; then
    echo "python3-venv not available. Installing..."
    if [ -f /etc/debian_version ]; then
        sudo apt-get update -qq
        sudo apt-get install -y python3-venv
        echo "python3-venv installed successfully."
    elif [ -f /etc/redhat_release ]; then
        sudo yum install -y python3-virtualenv
        echo "python3-virtualenv installed successfully."
    fi
else
    echo "python3-venv is available."
fi
# Clean up test venv
rm -rf "$TEST_VENV"

# Check if virtual environment exists and is valid
if [ -d $TST_DIR/.venv ]; then
    # Check if pip exists in venv (validates venv integrity)
    if ! [ -f $TST_DIR/.venv/bin/pip ]; then
        echo "Virtual environment is corrupted. Recreating..."
        rm -rf $TST_DIR/.venv
    fi
fi

# Create virtual environment if it doesn't exist
if ! [ -d $TST_DIR/.venv ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv ./.venv || {
        echo "ERROR: Failed to create virtual environment"
        echo "Please install python3-venv manually:"
        echo "  sudo apt-get install python3-venv"
        exit 1
    }
    echo "Virtual environment created."
fi

# Check if openapi-spec-validator is installed in venv
if ! ./.venv/bin/python -c "import openapi_spec_validator" 2>/dev/null; then
    echo "Installing openapi-spec-validator..."
    ./.venv/bin/pip install --quiet openapi-spec-validator
    echo "openapi-spec-validator installed successfully."
else
    echo "openapi-spec-validator is already installed."
fi

# Validate OpenAPI specification
echo "Validating OpenAPI specification..."
./.venv/bin/python -m openapi_spec_validator --errors all ../src/oas30.json

echo "✅ OpenAPI validation successful!"

set +e 
