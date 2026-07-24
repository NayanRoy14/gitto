import React, { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import { Confirm } from "../ui/Confirm.js";
import { Task } from "../ui/Task.js";
import { getRemoteUrl, addRemote, upload } from "../lib/git.js";
import { createRepo, suggestRepoName } from "../lib/github.js";

interface UploadProps {
  onDone?: (ok: boolean) => void;
}

type Step =
  | { kind: "loading" }
  | { kind: "confirm-visibility"; name: string }
  | { kind: "uploading"; create?: { name: string; private: boolean } };

export function Upload({ onDone }: UploadProps = {}) {
  const { exit } = useApp();
  const finish = onDone ?? (() => setTimeout(() => exit(), 50));
  const [step, setStep] = useState<Step>({ kind: "loading" });

  useEffect(() => {
    if (step.kind !== "loading") return;
    getRemoteUrl().then((url) => {
      setStep(
        url ? { kind: "uploading" } : { kind: "confirm-visibility", name: suggestRepoName() },
      );
    });
  }, [step.kind]);

  if (step.kind === "loading") {
    return (
      <Box>
        <Text dimColor>Checking this project...</Text>
      </Box>
    );
  }

  if (step.kind === "confirm-visibility") {
    return (
      <Confirm
        message={`This project isn't on GitHub yet. Create "${step.name}" as a private repo?`}
        onAnswer={(yes) =>
          setStep({ kind: "uploading", create: { name: step.name, private: yes } })
        }
      />
    );
  }

  return (
    <Task
      label={step.create ? `Creating "${step.create.name}" on GitHub...` : "Uploading to GitHub..."}
      run={async () => {
        if (step.create) {
          const { url } = await createRepo({
            name: step.create.name,
            private: step.create.private,
          });
          await addRemote(url);
        }
        const result = await upload();
        return result.message;
      }}
      onDone={finish}
      interactive={Boolean(onDone)}
    />
  );
}
