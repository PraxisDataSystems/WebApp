#!/bin/bash
# Automatically test models and switch on failure

MODELS=("nvidia/moonshotai/kimi-k2.5" "openai/gpt-4o-mini" "xai/grok-beta" "openai/gpt-4o" "anthropic/claude-sonnet-4-5")
MODEL_NAMES=("Kimi K2.5" "GPT-4o-mini" "Grok-3" "GPT-4o" "Claude Sonnet 4.5")
CURRENT_MODEL_INDEX=0

echo "🤖 Auto-tester started. Current model: ${MODEL_NAMES[$CURRENT_MODEL_INDEX]}"
echo "Click Export to start testing..."

while true; do
  # Wait for spawn request
  if [ -f /tmp/agent-manager-spawn-request.json ]; then
    sleep 2  # Let main agent process it
    
    # Get the latest job ID
    JOB_ID=$(PGPASSWORD='dev_password_change_in_prod' psql -h localhost -U propstream_app_user -d propstream_app -t -c "SELECT id FROM export_jobs ORDER BY created_at DESC LIMIT 1;")
    JOB_ID=$(echo $JOB_ID | xargs)  # trim whitespace
    
    if [ ! -z "$JOB_ID" ]; then
      echo "📊 Monitoring job #$JOB_ID with ${MODEL_NAMES[$CURRENT_MODEL_INDEX]}..."
      
      # Monitor for up to 10 minutes
      for i in {1..120}; do
        sleep 5
        STATUS=$(PGPASSWORD='dev_password_change_in_prod' psql -h localhost -U propstream_app_user -d propstream_app -t -c "SELECT status FROM export_jobs WHERE id=$JOB_ID;" | xargs)
        
        if [ "$STATUS" = "completed" ]; then
          echo "✅ SUCCESS! ${MODEL_NAMES[$CURRENT_MODEL_INDEX]} works!"
          echo "${MODELS[$CURRENT_MODEL_INDEX]}" > /tmp/winning-model.txt
          exit 0
        elif [ "$STATUS" = "failed" ]; then
          echo "❌ ${MODEL_NAMES[$CURRENT_MODEL_INDEX]} failed."
          CURRENT_MODEL_INDEX=$((CURRENT_MODEL_INDEX + 1))
          
          if [ $CURRENT_MODEL_INDEX -ge ${#MODELS[@]} ]; then
            echo "❌ All models tested. No success."
            exit 1
          fi
          
          # Switch to next model
          NEXT_MODEL="${MODELS[$CURRENT_MODEL_INDEX]}"
          NEXT_NAME="${MODEL_NAMES[$CURRENT_MODEL_INDEX]}"
          echo "🔄 Switching to $NEXT_NAME..."
          
          cd ~/clawd/propstream-app/worker
          sed -i "s|model: '.*'|model: '$NEXT_MODEL'|" index.ts
          pm2 restart propstream-worker > /dev/null 2>&1
          
          echo "✅ Ready for next test with $NEXT_NAME - Click Export again!"
          break
        fi
      done
    fi
  fi
  sleep 2
done
