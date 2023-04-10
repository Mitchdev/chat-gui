/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="globals/jquery/index.d.ts" />
/// <reference path="globals/moment/index.d.ts" />
/// <reference path="globals/nanoscroll/index.d.ts" />
/// <reference path="globals/store/index.d.ts" />

declare module '*.html' {
  const content: string;
  export default content;
}
