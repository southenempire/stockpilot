declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(location: string, options?: any);
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
  export class StatementSync {
    all(...params: any[]): any[];
    get(...params: any[]): any;
    run(...params: any[]): { changes: number; lastInsertRowid: number | bigint };
  }
}
