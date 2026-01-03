import { Editor } from "./editor";
import { InputManager } from "./inputManager";
import { ShaderRenderer } from "./render/shaderRenderer";

export interface AppState {
  files: Record<string, string>;
  loadedShader: string | null;
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
    "default.main": DEFAULT_SHADER,
  },
  loadedShader: "default.main",
  openTabs: ["default.main"],
  activeTab: "default.main",
  expandedGroups: ["default"],
  isSidebarOpen: true,
};

export class App {
  private static STORAGE_KEY = "editor-state";
  private state: AppState;

  public inputManager: InputManager;
  public renderer: ShaderRenderer;
  public editor: Editor;

  public shouldReload: boolean = false;

  constructor(
    canvas: HTMLCanvasElement,
    errorsDiv: HTMLDivElement,
    statusDiv: HTMLDivElement,
    editorContainer: HTMLElement,
    tabsContainer: HTMLElement,
    treeContainer: HTMLElement
  ) {
    this.inputManager = new InputManager();
    this.renderer = new ShaderRenderer(this, canvas, errorsDiv, statusDiv);

    const raw = localStorage.getItem(App.STORAGE_KEY);
    if (raw) {
      this.state = { ...DEFAULT_STATE, ...(JSON.parse(raw) as AppState) };
    } else {
      this.state = DEFAULT_STATE;
    }
    
    this.editor = new Editor(this, editorContainer, tabsContainer, treeContainer);
    
    this.reload();
    setInterval(() => this.reloadRoutine(), 1000);
  }

  reloadRoutine() {
    if (this.shouldReload && this.state.loadedShader) {
      this.reload();
      this.shouldReload = false;
    }
  }

  reload() {
    if (this.state.loadedShader) {
      this.renderer.loadShader(this.state.loadedShader);
    }
  }

  loadShader(file: string) {
    if (this.exists(file)) {
      this.state.loadedShader = file;
      this.save();
      this.renderer.loadShader(file);
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
    this.shouldReload = true;
  }

  listFiles(): string[] {
    return Object.keys(this.state.files);
  }

  deleteFile(path: string) {
    delete this.state.files[path];
    this.editor.closeTab(path);
    this.save();
  }

  renameFile(oldPath: string, newPath: string) {
    const content = this.state.files[oldPath];
    if (content !== undefined) {
      this.state.files[newPath] = content;
      delete this.state.files[oldPath];

      this.renameTab(oldPath, newPath);
      this.fixImports(oldPath, newPath);
      this.editor.reload();

      this.save();
    }
  }

  renameGroup(oldGroup: string, newGroup: string) {
    const files = Object.keys(this.state.files);
    const renamed = [];
    for (const file of files) {
      if (file.startsWith(oldGroup + ".")) {
        const newFile = newGroup + file.slice(oldGroup.length);
        this.state.files[newFile] = this.state.files[file];
        delete this.state.files[file];

        renamed.push({ old: file, new: newFile });

        this.renameTab(file, newFile);
      }
    }
    for (const pair of renamed) {
      this.fixImports(pair.old, pair.new);
    }
    const wasExpanded = this.isGroupExpanded(oldGroup);
    const idx = this.state.expandedGroups.indexOf(oldGroup);
    if (idx !== -1) {
      this.state.expandedGroups.splice(idx, 1);
    }
    if (wasExpanded) {
      this.state.expandedGroups.push(newGroup);
    }
    this.editor.reload();
    this.save();
  }

  fixImports(oldPath: string, newPath: string) {
    const files = Object.keys(this.state.files);
    for (const file of files) {
      let content = this.state.files[file];
      if (content.includes(oldPath)) {
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const trimmed = lines[i].trim();
          if (trimmed.startsWith("//")) {
            lines[i] = lines[i].replace(oldPath, newPath);
          }
        }
        this.state.files[file] = lines.join("\n");
        this.editor.updateCachedFile(file);
      }
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
      this.state.activeTab =
        this.state.openTabs.length > 0 ? this.state.openTabs[newIdx] : null;
    }
    this.save();
  }

  renameTab(oldPath: string, newPath: string) {
    const idx = this.state.openTabs.indexOf(oldPath);
    if (idx !== -1) {
      this.state.openTabs[idx] = newPath;
    }
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
