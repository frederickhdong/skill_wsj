#!/bin/bash
# PreToolUse hook for EnterPlanMode — remind to include doc updates in the plan
echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"Before planning: Always include PRD.md updates and an ADR in decisions/ as steps in the plan. ADR format: Status, Context, Decision, Alternatives Considered, Consequences."}}'
