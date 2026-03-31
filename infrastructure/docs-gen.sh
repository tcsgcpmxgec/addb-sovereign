#!/bin/bash

# ADDB Self-Documenting Engine v1.0.0
# Automatically updates ARCHITECTURE.md and TROUBLESHOOTING.md

echo "Initializing Self-Documenting Engine..."

# Update ARCHITECTURE.md with current file structure
echo "# ADDB Sovereign Architect v1.0.0 - System Architecture" > docs/ARCHITECTURE.md
echo "" >> docs/ARCHITECTURE.md
echo "## Current File Structure (Monorepo)" >> docs/ARCHITECTURE.md
echo "\`\`\`" >> docs/ARCHITECTURE.md
find . -maxdepth 2 -not -path '*/.*' >> docs/ARCHITECTURE.md
echo "\`\`\`" >> docs/ARCHITECTURE.md

# Update TROUBLESHOOTING.md with common error codes
echo "# ADDB Sovereign Architect v1.0.0 - Troubleshooting Guide" > docs/TROUBLESHOOTING.md
echo "" >> docs/TROUBLESHOOTING.md
echo "## Common Error Codes" >> docs/TROUBLESHOOTING.md
echo "| Code | Description | Resolution |" >> docs/TROUBLESHOOTING.md
echo "|------|-------------|------------|" >> docs/TROUBLESHOOTING.md
echo "| ERR_WS_DISCONNECT | WebSocket connection lost | Check backend server status |" >> docs/TROUBLESHOOTING.md
echo "| EVO_BUILD_FAIL | Evolution patch failed to build | Review lint logs in SYSTEM EVOLUTION |" >> docs/TROUBLESHOOTING.md
echo "| SCANNER_CRITICAL_ALERT | Security leak detected | Immediate lockdown of affected modules |" >> docs/TROUBLESHOOTING.md

echo "Documentation updated successfully."
