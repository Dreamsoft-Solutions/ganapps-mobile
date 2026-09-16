declare module 'markdown-it-ins' {
  import type MarkdownIt from 'markdown-it';

  const markdownItIns: (markdownIt: MarkdownIt) => void;

  export default markdownItIns;
}
