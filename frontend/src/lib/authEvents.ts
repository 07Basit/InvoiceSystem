// Lets the API client tell the auth store that the server rejected the session (401),
// without the two modules importing each other.
type Listener = () => void;
let listener: Listener | null = null;

export function onUnauthorized(fn: Listener): void {
  listener = fn;
}

export function notifyUnauthorized(): void {
  listener?.();
}
