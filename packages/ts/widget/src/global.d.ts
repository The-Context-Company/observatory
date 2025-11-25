declare global {
  interface Window {
    TCC_DEBUG?: boolean;
    TCC_WSS_PORT?: string;
  }

  declare module "*.css" {
    const content: string;
    export default content;
  }

  declare module "*.css?inline" {
    const content: string;
    export default content;
  }

  declare module "*.png" {
    const content: string;
    export default content;
  }
}

export {};
