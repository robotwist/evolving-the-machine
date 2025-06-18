export class InputHandler {
  private keys: Set<string> = new Set();
  private callbacks: Map<string, Function[]> = new Map();

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    document.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      this.triggerCallbacks('keydown', e.code);
    });

    document.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.triggerCallbacks('keyup', e.code);
    });
  }

  isKeyPressed(key: string): boolean {
    return this.keys.has(key);
  }

  onKeyDown(key: string, callback: Function) {
    const eventKey = `keydown:${key}`;
    if (!this.callbacks.has(eventKey)) {
      this.callbacks.set(eventKey, []);
    }
    this.callbacks.get(eventKey)!.push(callback);
  }

  onKeyUp(key: string, callback: Function) {
    const eventKey = `keyup:${key}`;
    if (!this.callbacks.has(eventKey)) {
      this.callbacks.set(eventKey, []);
    }
    this.callbacks.get(eventKey)!.push(callback);
  }

  private triggerCallbacks(event: string, key: string) {
    const eventKey = `${event}:${key}`;
    const callbacks = this.callbacks.get(eventKey);
    if (callbacks) {
      callbacks.forEach(callback => callback());
    }
  }

  destroy() {
    this.callbacks.clear();
    this.keys.clear();
  }
}
