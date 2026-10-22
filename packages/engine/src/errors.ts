/** Thrown when the engine is called in a state or with input it cannot handle. */
export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineError";
  }
}
