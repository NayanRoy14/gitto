import React, { useState } from "react";
import { Prompt } from "../ui/Prompt.js";
import { Download } from "./Download.js";

interface DownloadFlowProps {
  onDone?: (ok: boolean) => void;
}

export function DownloadFlow({ onDone }: DownloadFlowProps = {}) {
  const [url, setUrl] = useState<string | null>(null);

  if (url === null) {
    return (
      <Prompt
        message="What's the GitHub URL to copy?"
        placeholder="https://github.com/owner/repo.git"
        onSubmit={(value) => value.trim() && setUrl(value.trim())}
      />
    );
  }

  return <Download url={url} onDone={onDone} />;
}
