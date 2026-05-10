#!/bin/bash
set -u

echo "Restarting Ollama with SMAC CORS settings..."

pkill -f "ollama serve" 2>/dev/null
sleep 1

OLLAMA_ORIGINS="*" OLLAMA_HOST="127.0.0.1:11434" ollama serve >/tmp/ollama_smac.log 2>&1 &
OLLAMA_PID=$!

sleep 3

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:11434/)
CORS_HEADER=$(curl -s -D - -o /dev/null -H "Origin: chrome-extension://test" http://localhost:11434/ | grep -i "^Access-Control-Allow-Origin:" || true)

if [ "$HTTP_STATUS" = "200" ] && echo "$CORS_HEADER" | grep -qi "\*"; then
    echo "✅ Ollama is running (PID: $OLLAMA_PID). SMAC is ready."
    echo "Run 'ollama list' to confirm your model is pulled."
else
    echo "Ollama failed to start correctly. Check /tmp/ollama_smac.log"
    echo "HTTP status: $HTTP_STATUS"
    if [ -n "$CORS_HEADER" ]; then
        echo "$CORS_HEADER"
    else
        echo "Access-Control-Allow-Origin header not detected."
    fi
fi
