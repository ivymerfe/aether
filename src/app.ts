import type { ShaderRenderer } from "./renderer";

export interface AppState {
  files: Record<string, string>;
  loadedFile: string | null;
  openTabs: string[];
  activeTab: string | null;
  expandedGroups: string[];
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
  loadedFile: 'default.main',
  openTabs: ['default.main'],
  activeTab: 'default.main',
  expandedGroups: ['default'],
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
      this.state = { ...DEFAULT_STATE, ...JSON.parse(raw) as AppState };
    } else {
      this.state = DEFAULT_STATE;
    }
    if (this.state.loadedFile) {
      const content = this.state.files[this.state.loadedFile];
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

  exists(path: string): boolean {
    return this.state.files.hasOwnProperty(path);
  }

  write(path: string, content: string, hasError: boolean) {
    this.state.files[path] = content;
    this.save();
    if (!hasError) {
      this.renderer.compileAndStart(content);
    }
  }

  listFiles(): string[] {
    return Object.keys(this.state.files);
  }

  deleteFile(path: string) {
    delete this.state.files[path];
    this.save();
  }

  renameFile(oldPath: string, newPath: string) {
    const content = this.state.files[oldPath];
    if (content !== undefined) {
      this.state.files[newPath] = content;
      delete this.state.files[oldPath];

      this.closeTab(oldPath);
      this.openTab(newPath);

      this.save();
    }
  }

  renameGroup(oldGroup: string, newGroup: string) {
    const files = Object.keys(this.state.files);
    for (const file of files) {
      if (file.startsWith(oldGroup + '.')) {
        const newFile = newGroup + file.slice(oldGroup.length);
        this.state.files[newFile] = this.state.files[file];
        delete this.state.files[file];

        this.closeTab(file);
        this.openTab(newFile);
      }
    }
    const wasExpanded = this.isGroupExpanded(oldGroup);
    const idx = this.state.expandedGroups.indexOf(oldGroup);
    if (idx !== -1) {
      this.state.expandedGroups.splice(idx, 1);
    }
    if (wasExpanded) {
      this.state.expandedGroups.push(newGroup);
    }
    this.save();
  }

  loadFile(file: string) {
    const content = this.state.files[file];
    if (content !== undefined) {
      this.state.loadedFile = file;
      this.save();
      this.renderer.compileAndStart(content);
    }
  }

  get openTabs(): string[] {
    return this.state.openTabs;
  }

  get activeTab(): string | null {
    return this.state.activeTab;
  }

  get expandedGroups(): Set<string> {
    return new Set(this.state.expandedGroups);
  }

  get isSidebarOpen(): boolean {
    return this.state.isSidebarOpen;
  }

  isGroupExpanded(group: string): boolean {
    return this.state.expandedGroups.includes(group);
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

  toggleGroup(group: string) {
    const idx = this.state.expandedGroups.indexOf(group);
    if (idx === -1) {
      this.state.expandedGroups.push(group);
    } else {
      this.state.expandedGroups.splice(idx, 1);
    }
    this.save();
    return idx === -1;
  }
}
