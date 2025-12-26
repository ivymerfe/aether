import type { ShaderRenderer } from "./renderer";

export interface AppState {
  files: Record<string, string>;
  loadedProject: string | null;
  openTabs: string[];
  activeTab: string | null;
  expandedProjects: string[];
  isSidebarOpen: boolean;
}

const DEFAULT_SHADER = `
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord * 2.0 - iResolution) / iResolution.y;
  fragColor = vec4(uv, 0.5, 1.0);
}`;

const DEFAULT_STATE: AppState = {
  files: {
    'default.main': DEFAULT_SHADER
  },
  loadedProject: 'default',
  openTabs: ['default.main'],
  activeTab: 'default.main',
  expandedProjects: ['default'],
  isSidebarOpen: true
};

export class App {
  private static STORAGE_KEY = 'editor-state';
  private state: AppState;
  private renderer: ShaderRenderer;

  constructor(renderer: ShaderRenderer) {
    this.renderer = renderer;

    const raw = localStorage.getItem(App.STORAGE_KEY);
    if (raw) {
      this.state = JSON.parse(raw) as AppState;
    } else {
      this.state = DEFAULT_STATE;
    }
    if (this.state.loadedProject) {
      const mainFile = `${this.state.loadedProject}.main`;
      const content = this.state.files[mainFile];
      if (content) {
        this.renderer.compileAndStart(content);
      }
    }
  }

  private save() {
    localStorage.setItem(App.STORAGE_KEY, JSON.stringify(this.state));
  }

  read(path: string): string | null {
    return this.state.files[path] ?? null;
  }

  write(path: string, content: string, hasError: boolean) {
    this.state.files[path] = content;
    this.save();
    const project = path.split('.')[0];
    if (!hasError && this.state.loadedProject === project) {
      this.renderer.compileAndStart(content);
    }
  }

  listFiles(): string[] {
    return Object.keys(this.state.files);
  }

  get openTabs(): string[] {
    return this.state.openTabs;
  }

  get activeTab(): string | null {
    return this.state.activeTab;
  }

  get expandedProjects(): Set<string> {
    return new Set(this.state.expandedProjects);
  }

  get isSidebarOpen(): boolean {
    return this.state.isSidebarOpen;
  }

  setSidebarOpen(open: boolean) {
    this.state.isSidebarOpen = open;
    this.save();
  }

  openTab(path: string) {
    if (!this.state.openTabs.includes(path)) {
      this.state.openTabs.push(path);
    }
    this.state.activeTab = path;
    this.save();
  }

  closeTab(path: string) {
    const idx = this.state.openTabs.indexOf(path);
    if (idx !== -1) {
      this.state.openTabs.splice(idx, 1);
    }
    if (this.state.activeTab === path) {
      const newIdx = idx > 0 ? idx - 1 : 0;
      this.state.activeTab = this.state.openTabs.length > 0 ? this.state.openTabs[newIdx] : null;
    }
    this.save();
  }

  setActiveTab(path: string) {
    if (this.state.openTabs.includes(path)) {
      this.state.activeTab = path;
      this.save();
    }
  }

  toggleProjectExpansion(project: string) {
    const idx = this.state.expandedProjects.indexOf(project);
    if (idx === -1) {
      this.state.expandedProjects.push(project);
    } else {
      this.state.expandedProjects.splice(idx, 1);
    }
    this.save();
  }
}
