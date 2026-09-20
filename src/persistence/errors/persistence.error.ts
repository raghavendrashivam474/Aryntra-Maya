export class PersistenceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "PersistenceError";
  }
}

export class InitializationError extends PersistenceError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "InitializationError";
  }
}

export class ReadError extends PersistenceError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "ReadError";
  }
}

export class WriteError extends PersistenceError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "WriteError";
  }
}

export class PersistenceValidationError extends PersistenceError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "PersistenceValidationError";
  }
}

export class UnsupportedSchemaVersionError extends PersistenceError {
  constructor(public readonly version: number, message?: string) {
    super(message ?? `Unsupported schema version: ${version}`);
    this.name = "UnsupportedSchemaVersionError";
  }
}
