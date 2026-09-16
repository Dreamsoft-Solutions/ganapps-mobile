declare module 'markdown-it' {
  export interface MarkdownItOptions {
    breaks?: boolean;
    html?: boolean;
    linkify?: boolean;
    typographer?: boolean;
  }

  export interface MarkdownToken {
    attrIndex(name: string): number;
    attrs: Array<[string, string]> | null;
    block: boolean;
    children: MarkdownToken[] | null;
    content: string;
    info: string;
    markup: string;
    meta: MarkdownData;
    nesting: -1 | 0 | 1;
    tag: string;
    type: string;
  }

  type MarkdownData = null | boolean | number | string | MarkdownData[] | { [key: string]: MarkdownData };

  export interface MarkdownIt {
    parse(value: string, env: Record<string, never>): MarkdownToken[];
    use(plugin: (markdownIt: MarkdownIt) => void): MarkdownIt;
  }

  interface MarkdownItConstructor {
    new (options?: MarkdownItOptions): MarkdownIt;
  }

  const MarkdownIt: MarkdownItConstructor;

  export default MarkdownIt;
}
