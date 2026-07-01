// Minimal ambient types for the Cloudflare Pages Functions runtime. These files
// are compiled by wrangler/esbuild (type annotations are stripped), not by the
// app's `tsc -b`, so this only serves the editor.
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

type PagesFunction<Env = unknown> = (context: {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
  next: () => Promise<Response>;
  waitUntil: (promise: Promise<unknown>) => void;
}) => Response | Promise<Response>;
