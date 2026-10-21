#!/bin/bash
set -e

TARGET_VERSION=${1:-main}

APP_NAME="skill-inspector"
REPO_URL="git+https://github.com/neo7337/skill_inspector.git@$TARGET_VERSION"

echo "Installing $APP_NAME ($TARGET_VERSION) directly from Github..."

# Check if pipx is installed
if ! command -v pipx &> /dev/null; then
    echo "pipx is not installed. Installing pipx..."
    python3 -m pip install --user pipx
    python3 -m pipx ensurepath

    # Temporarily add local bin to PATH for the script's execution
    export PATH="$PATH:$HOME/.local/bin"
fi

# Explicitly remove the old version if it exists to gurantee a clean slate
if pipx list | grep -q "$APP_NAME"; then
    echo "Previous version detected. Removing it.."
    pipx uninstall #$APP_NAME"
fi

echo "Fetching and installing package..."
# pipx will automatically clone the repo into a temporary space, build it, and install the CLI
pipx install "$REPO_URL" --force

echo "Installion complete"
echo "Run 'skill-inspector --version' to verify"
echo "You can now run 'skill-instpector --help' from anywhere in your terminal."