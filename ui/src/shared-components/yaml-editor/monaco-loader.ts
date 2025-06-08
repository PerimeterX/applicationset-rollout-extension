// types.ts - Define global types
declare global {
    interface Window {
      require: {
        config: (config: { paths: { vs: string } }) => void;
        (modules: string[], callback: () => void, errorCallback?: (error: any) => void): void;
      };
      monaco: typeof import('monaco-editor');
    }
  }
  
  // monaco-loader.ts
  class MonacoLoader {
    private baseUrl: string;
    private loaded: boolean = false;
    private loadPromise: Promise<typeof import('monaco-editor')> | null = null;
  
    constructor(version: string = '0.52.2') {
      this.baseUrl = `https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${version}/min/vs`;
    }
  
    async load(): Promise<typeof import('monaco-editor')> {
      if (this.loaded) {
        return window.monaco;
      }
  
      if (this.loadPromise) {
        return this.loadPromise;
      }
  
      this.loadPromise = this._loadMonaco();
      return this.loadPromise;
    }
  
    private async _loadMonaco(): Promise<typeof import('monaco-editor')> {
      // Load AMD loader
      await this._loadScript(`${this.baseUrl}/loader.min.js`);
  
      // Configure paths
      window.require.config({ paths: { vs: this.baseUrl } });
  
      // Load Monaco main module
      return new Promise<typeof import('monaco-editor')>((resolve, reject) => {
        window.require(['vs/editor/editor.main'], () => {
          this.loaded = true;
          resolve(window.monaco);
        }, reject);
      });
    }
  
    private _loadScript(src: string): Promise<void> {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
      });
    }
  }
  
  export default MonacoLoader;