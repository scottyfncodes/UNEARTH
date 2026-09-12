/**
 * Minimal observable store. Framework-agnostic on purpose: game state must be
 * usable from the render loop and from tests without React in the picture.
 */
export type Listener = () => void;

export class Store<T> {
  private state: T;
  private listeners = new Set<Listener>();

  constructor(initial: T) {
    this.state = initial;
  }

  get(): T {
    return this.state;
  }

  set(next: T): void {
    if (next === this.state) return;
    this.state = next;
    this.emit();
  }

  update(fn: (current: T) => T): void {
    this.set(fn(this.state));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }
}
