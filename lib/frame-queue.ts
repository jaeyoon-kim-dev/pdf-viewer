// Keep only the latest update between display frames; clearing a gesture must
// also cancel a queued update so its selection cannot reappear after release.
export function frameQueue<T>(
  paint: (value: T) => void,
  request: (callback: FrameRequestCallback) => number = requestAnimationFrame,
  cancel: (id: number) => void = cancelAnimationFrame,
) {
  let frame: number | undefined;
  let pending: T;
  return {
    push(value: T) {
      pending = value;
      if (frame !== undefined) return;
      frame = request(() => {
        frame = undefined;
        paint(pending);
      });
    },
    clear() {
      if (frame !== undefined) cancel(frame);
      frame = undefined;
    },
  };
}
