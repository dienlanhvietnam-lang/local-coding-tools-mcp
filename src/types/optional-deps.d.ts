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
  export interface Page {
    goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
    url(): string;
    title(): Promise<string>;
    screenshot(options?: Record<string, unknown>): Promise<Buffer | void>;
    locator(selector: string): {
      first(): {
        click(options?: Record<string, unknown>): Promise<void>;
        fill(value: string, options?: Record<string, unknown>): Promise<void>;
        press(key: string, options?: Record<string, unknown>): Promise<void>;
        selectOption(value: string, options?: Record<string, unknown>): Promise<void>;
        hover(options?: Record<string, unknown>): Promise<void>;
      };
    };
    accessibility: {
      snapshot(): Promise<unknown>;
    };
  }

  export interface BrowserContext {
    newPage(): Promise<Page>;
    close(): Promise<void>;
  }

  export interface Browser {
    newContext(options?: Record<string, unknown>): Promise<BrowserContext>;
    close(): Promise<void>;
  }

  export const chromium: {
    launch(options?: Record<string, unknown>): Promise<Browser>;
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
