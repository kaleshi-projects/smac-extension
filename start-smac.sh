#!/bin/bash
set -u

echo "Restarting Ollama with SMAC CORS settings..."

pkill -f "ollama serve" 2>/dev/null
sleep 1

OLLAMA_ORIGINS="*" OLLAMA_HOST="127.0.0.1:11434" ollama serve >/tmp/ollama_smac.log 2>&1 &
OLLAMA_PID=$!

sleep 3

VERIFY_URL="http://localhost:11434/api/tags"
VERIFY_ARGS=(-H "Origin: chrome-extension://test")
VERIFY_MODEL="${SMAC_OLLAMA_VERIFY_MODEL:-$(ollama list 2>/dev/null | awk 'NR==2 {print $1}')}"

if [ -n "$VERIFY_MODEL" ]; then
    VERIFY_URL="http://localhost:11434/api/generate"
    VERIFY_ARGS+=(
        -H "Content-Type: application/json"
        -d "{\"model\":\"$VERIFY_MODEL\",\"prompt\":\"hi\",\"stream\":false}"
    )
fi

VERIFY_OUTPUT=$(curl -s -D - -o /tmp/ollama_smac_verify_body.txt \
    "${VERIFY_ARGS[@]}" \
    "$VERIFY_URL" 2>/tmp/ollama_smac_verify_error.txt || true)
HTTP_STATUS=$(printf "%s" "$VERIFY_OUTPUT" | awk 'toupper($1) ~ /^HTTP/ { code=$2 } END { print code }')
CORS_HEADER=$(printf "%s" "$VERIFY_OUTPUT" | grep -i "^Access-Control-Allow-Origin:" || true)

if [ "$HTTP_STATUS" = "200" ] && echo "$CORS_HEADER" | grep -qi "\*"; then
    echo "✅ Ollama is running (PID: $OLLAMA_PID). SMAC is ready."
    if [ -n "$VERIFY_MODEL" ]; then
        echo "CORS verified against model: $VERIFY_MODEL"
    else
        echo "CORS verified. Run 'ollama list' to confirm your model is pulled."
    fi
else
    echo "Ollama failed to start correctly. Check /tmp/ollama_smac.log"
    echo "HTTP status: $HTTP_STATUS"
    if [ -s /tmp/ollama_smac_verify_error.txt ]; then
        cat /tmp/ollama_smac_verify_error.txt
    fi
    if [ -n "$CORS_HEADER" ]; then
        echo "$CORS_HEADER"
    else
        echo "Access-Control-Allow-Origin header not detected."
    fi
fi
