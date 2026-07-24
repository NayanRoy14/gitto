/**
 * Node's built-in readline (both the callback and promises APIs) drops lines
 * on piped/non-TTY stdin when a second `question()` is issued after the first
 * resolves — the whole piped buffer arrives in one `data` event before any
 * resolver is queued for the later lines, and readline's internal handling
 * discards them instead of queuing them. Confirmed directly against this
 * exact scenario (piped input, sequential questions) before writing this.
 * This reader queues arrived-but-not-yet-asked-for lines itself instead of
 * relying on readline's stream-pause/resume dance.
 */
export interface LineReader {
  question(query: string): Promise<string>;
  hasEnded(): boolean;
  close(): void;
}

export function createLineReader(): LineReader {
  let buffer = "";
  const pendingLines: string[] = [];
  const waitingResolvers: Array<(line: string | null) => void> = [];
  let ended = false;

  const onData = (chunk: string) => {
    buffer += chunk;
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).replace(/\r$/, "");
      buffer = buffer.slice(idx + 1);
      const resolver = waitingResolvers.shift();
      if (resolver) {
        resolver(line);
      } else {
        pendingLines.push(line);
      }
    }
  };

  const onEnd = () => {
    ended = true;
    let resolver: ((line: string | null) => void) | undefined;
    while ((resolver = waitingResolvers.shift())) resolver(null);
  };

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", onData);
  process.stdin.on("end", onEnd);
  process.stdin.resume();

  return {
    question(query: string): Promise<string> {
      process.stdout.write(query);
      const pending = pendingLines.shift();
      if (pending !== undefined) return Promise.resolve(pending);
      if (ended) return Promise.resolve("");
      return new Promise<string>((resolve) => {
        waitingResolvers.push((line) => resolve(line ?? ""));
      });
    },
    hasEnded(): boolean {
      return ended && pendingLines.length === 0;
    },
    close(): void {
      process.stdin.off("data", onData);
      process.stdin.off("end", onEnd);
      process.stdin.pause();
    },
  };
}
