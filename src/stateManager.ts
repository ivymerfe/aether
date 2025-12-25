export interface AppState {
  files: Record<string, string>;
  openTabs: string[];
  activeTab: string | null;
  expandedProjects: string[];
  isSidebarOpen: boolean;
}

const DEFAULT_STATE: AppState = {
  files: {
    'default.main': ``,
    'default.fragment': `void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n  vec2 uv = (fragCoord * 2.0 - iResolution) / iResolution.y;\n  fragColor = vec4(uv, 0.5, 1.0);\n}`
  },
  openTabs: ['default.fragment'],
  activeTab: 'default.fragment',
  expandedProjects: ['default'],
  isSidebarOpen: true
};

export class StateManager {
  private static STORAGE_KEY = 'editor-state';
  private state: AppState;

  constructor() {
    const raw = localStorage.getItem(StateManager.STORAGE_KEY);
    if (raw) {
      try {
        this.state = { ...DEFAULT_STATE, ...JSON.parse(raw) };
        // Merge files to ensure defaults exist if storage is partial
        this.state.files = { ...DEFAULT_STATE.files, ...this.state.files };
      } catch (e) {
        console.error("Failed to load state", e);
        this.state = { ...DEFAULT_STATE };
      }
    } else {
      this.state = { ...DEFAULT_STATE };
    }
  }

  private save() {
    localStorage.setItem(StateManager.STORAGE_KEY, JSON.stringify(this.state));
  }

  getFile(path: string): string | null {
    return this.state.files[path] ?? null;
  }

  writeFile(path: string, content: string) {
    this.state.files[path] = content;
    this.save();
  }

  getFiles(): string[] {
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
    this.state.openTabs = this.state.openTabs.filter(t => t !== path);
    if (this.state.activeTab === path) {
      this.state.activeTab = this.state.openTabs.length > 0
        ? this.state.openTabs[this.state.openTabs.length - 1]
        : null;
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
