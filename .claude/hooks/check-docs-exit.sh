#!/bin/bash
# PreToolUse hook for ExitPlanMode — remind to update docs before finalizing plan
echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"Reminder: Update PRD.md and create an ADR in decisions/ as part of this implementation. ADR format: Status, Context, Decision, Alternatives Considered, Consequences."}}'
