declare module "pngjs" {
  export class PNG {
    width: number;
    height: number;
    data: Buffer;
    constructor(options?: { width: number; height: number; filterType?: number });
    static sync: {
      read(buffer: Buffer): PNG;
      write(png: PNG): Buffer;
    };
  }
}

declare module "playwright-core" {
  export const chromium: {
    launch(options?: Record<string, unknown>): Promise<{
      newPage(options?: Record<string, unknown>): Promise<{
        goto(url: string, options?: Record<string, unknown>): Promise<void>;
      }>;
      close(): Promise<void>;
    }>;
  };
}

declare module "@axe-core/playwright" {
  export class AxeBuilder {
    constructor(options: { page: unknown });
    analyze(): Promise<{
      violations: Array<{
        id: string;
        impact?: string;
        description: string;
        help: string;
        nodes: Array<{ target: string[] }>;
      }>;
    }>;
  }
}
