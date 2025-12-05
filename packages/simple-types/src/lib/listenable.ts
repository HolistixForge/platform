//

type Listener = () => void;

export class Listenable {
  private listeners: Listener[] = [];

  addListener(listener: Listener, ...args: any): void {
    this.listeners.push(listener);
  }

  removeListener(listener: Listener, ...args: any): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  protected notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }
}
