/**
 * ink-testing-library's stdin.write() emits synchronously; a freshly mounted
 * component's useInput/useEffect listeners attach a tick later, and multiple
 * writes fired back-to-back in the same tick get batched (React reads a
 * stale closure for each). Every simulated keypress needs a settling tick
 * before the next one — including the very first, right after render().
 */

interface WritableStdin {
  write(data: string): void;
}

/**
 * Ink attaches its raw-mode stdin listener from a useEffect (setRawMode(true)
 * in use-input.js), which fires a tick after the initial commit — not
 * synchronously during render(). The very first simulated keypress after
 * render() needs to wait for that, or it's written before anything is
 * listening and silently dropped.
 */
export async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

export async function pressKey(stdin: WritableStdin, key: string): Promise<void> {
  stdin.write(key);
  await new Promise((resolve) => setTimeout(resolve, 0));
}

export async function typeText(stdin: WritableStdin, text: string): Promise<void> {
  for (const char of text) {
    await pressKey(stdin, char);
  }
}
