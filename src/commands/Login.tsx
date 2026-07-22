import React, { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import Spinner from "ink-spinner";
import { login, type DeviceVerification } from "../lib/auth.js";

type Phase =
  | { kind: "starting" }
  | { kind: "waiting"; info: DeviceVerification }
  | { kind: "success"; login: string }
  | { kind: "error"; message: string };

interface LoginProps {
  onComplete?: (result: { ok: boolean; message: string }) => void;
}

export function Login({ onComplete }: LoginProps = {}) {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>({ kind: "starting" });

  useEffect(() => {
    login((info) => setPhase({ kind: "waiting", info }))
      .then(({ login: username }) => setPhase({ kind: "success", login: username }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        setPhase({ kind: "error", message });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase.kind === "success" || phase.kind === "error") {
      if (onComplete) {
        onComplete({
          ok: phase.kind === "success",
          message: phase.kind === "success" ? `Logged in as ${phase.login}.` : phase.message,
        });
        return;
      }
      const timer = setTimeout(() => exit(), 50);
      return () => clearTimeout(timer);
    }
  }, [phase, exit, onComplete]);

  if (phase.kind === "starting") {
    return (
      <Box>
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
        <Text> Connecting to GitHub...</Text>
      </Box>
    );
  }

  if (phase.kind === "waiting") {
    return (
      <Box flexDirection="column">
        <Text>Go to <Text color="cyan">{phase.info.verificationUri}</Text> and enter this code:</Text>
        <Box marginTop={1}>
          <Text bold color="yellow"> {phase.info.userCode} </Text>
        </Box>
        <Box marginTop={1}>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text> Waiting for you to approve in the browser...</Text>
        </Box>
      </Box>
    );
  }

  if (phase.kind === "success") {
    return (
      <Box>
        <Text color="green">✓ </Text>
        <Text>Logged in as {phase.login}.</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text color="red">✗ </Text>
      <Text>{phase.message}</Text>
    </Box>
  );
}
