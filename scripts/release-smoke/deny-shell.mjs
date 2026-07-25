process.stdout.write(
  `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason:
        "Shell execution is disabled while the OpenAI credential proxy is active. Author files with apply_patch; validation runs in the next job without the secret.",
    },
  })}\n`,
);
