#!/bin/bash
# Auto-test models until one works

MODELS=(
  "openai/gpt-4o-mini"
  "xai/grok-beta"
  "openai/gpt-4o"
  "anthropic/claude-sonnet-4-5"
)

MODEL_NAMES=(
  "GPT-4o-mini"
  "Grok-3"
  "GPT-4o"
  "Claude Sonnet 4.5"
)

for i in "${!MODELS[@]}"; do
  MODEL="${MODELS[$i]}"
  NAME="${MODEL_NAMES[$i]}"
  
  echo "Testing model: $NAME ($MODEL)"
  
  # Update worker to use this model
  cd ~/clawd/propstream-app/worker
  sed -i "s|model: \".*\"|model: \"$MODEL\"|" index.ts
  pm2 restart propstream-worker
  
  echo "Waiting for you to click Export..."
  
  # Wait for spawn request
  while [ ! -f /tmp/agent-manager-spawn-request.json ]; do
    sleep 1
  done
  
  # Get job ID from spawn request
  JOB_ID=$(jq -r '.task' /tmp/agent-manager-spawn-request.json | grep -oP 'id=\K\d+')
  
  echo "Job $JOB_ID spawned with $NAME, monitoring..."
  
  # Monitor for up to 10 minutes
  for j in {1..120}; do
    sleep 5
    STATUS=$(PGPASSWORD='dev_password_change_in_prod' psql -h localhost -U propstream_app_user -d propstream_app -t -c "SELECT status FROM export_jobs WHERE id=$JOB_ID;")
    
    if [[ "$STATUS" =~ "completed" ]]; then
      echo "✅ SUCCESS with $NAME!"
      exit 0
    elif [[ "$STATUS" =~ "failed" ]]; then
      echo "❌ $NAME failed, trying next model..."
      break
    fi
  done
done

echo "All models tested."
