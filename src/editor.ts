import { EditorState, type Extension } from "@codemirror/state"
import { drawSelection, EditorView, highlightActiveLine, keymap } from "@codemirror/view"
import { defaultKeymap, history, redo } from "@codemirror/commands"
import { glsl } from "./glsl-lang/glsl"
import { vsCodeDark } from './theme'
import { lineNumbers } from "@codemirror/view"
import { indentWithTab } from "@codemirror/commands"
import { indentationMarkers } from './indent-markers'
import { indentOnInput, indentUnit, syntaxTree } from "@codemirror/language"
import { linter, type Diagnostic } from '@codemirror/lint'
import { search, searchKeymap } from '@codemirror/search'

import { FileTreeView } from './treeView'
import { App } from './app'

const EXTENSIONS = [
  lineNumbers(),
  keymap.of([
    ...defaultKeymap,
    indentWithTab,
    { key: "Ctrl-Shift-z", run: redo },
    ...searchKeymap
  ]),
  EditorState.tabSize.of(4),
  EditorState.allowMultipleSelections.of(true),
  indentUnit.of("    "),
  history({}),
  glsl(),
  vsCodeDark,
  highlightActiveLine(),
  indentationMarkers(),
  indentOnInput(),
  drawSelection(),
  search({ top: true }),
  linter(view => {
    const { state } = view;
    const tree = syntaxTree(state);
    let errors: Diagnostic[] = [];
    tree.iterate({
      enter: n => {
        if (n.type.isError) {
          errors.push({ from: n.from, to: n.to + 1, severity: 'error', message: 'syntax error' });
        }
      }
    });
    return errors;
  })
];

const EMPTY_STATE = EditorState.create({ doc: "", extensions: EXTENSIONS });

export class Editor {
  public view: EditorView;
  private app: App;
  private tabsContainer: HTMLElement;
  private treeView: FileTreeView;
  private extensions: Extension[];
  private loadedFiles: Record<string, EditorState> = {};
  private tabPool: HTMLElement[] = [];

  constructor(app: App, editorContainer: HTMLElement, tabsContainer: HTMLElement, treeContainer: HTMLElement) {
    this.app = app;
    this.tabsContainer = tabsContainer;

    this.view = new EditorView({
      parent: editorContainer
    });

    const updateListener = EditorView.updateListener.of(update => {
      if (update.docChanged) {
        const active = this.app.activeTab;
        if (active) {
          const content = update.state.doc.toString();
          const tree = syntaxTree(update.state);
          let hasError = false;
          tree.iterate({
            enter: (node) => {
              if (node.type.isError) {
                hasError = true;
                return false;
              }
            }
          });
          this.app.write(active, content, hasError);
          this.loadedFiles[active] = update.state;
        }
      }
    });
    this.extensions = [...EXTENSIONS, updateListener];

    this.bindTabEvents();
    this.treeView = new FileTreeView(treeContainer, app, this);
    this.reload();
  }

  reload() {
    this.renderTabs();
    const active = this.app.activeTab;
    if (active) {
      this.loadFile(active);
    }
  }

  openTab(path: string) {
    this.app.openTab(path);
    this.loadFile(path);
    this.renderTabs();
  }

  closeTab(path: string) {
    this.app.closeTab(path);
    const newActive = this.app.activeTab;
    if (newActive) {
      this.loadFile(newActive);
    } else {
      this.view.setState(EMPTY_STATE);
    }
    this.renderTabs();
  }

  setActiveTab(path: string) {
    this.app.setActiveTab(path);
    this.loadFile(path);
    this.renderTabs();
  }

  private loadFile(path: string) {
    if (this.loadedFiles[path]) {
      this.view.setState(this.loadedFiles[path]);
      return;
    }
    const content = this.app.read(path);
    if (content !== null) {
      const fileState = EditorState.create({
        doc: content,
        extensions: this.extensions
      });
      this.view.setState(fileState);
      this.loadedFiles[path] = fileState;
    }
  }

  private bindTabEvents() {
    this.tabsContainer.addEventListener('mouseup', (e) => {
      const target = e.target as HTMLElement;
      const tabEl = target.closest('.tab') as HTMLElement;
      if (!tabEl) return;

      const path = tabEl.dataset.path!;
      if (e.button === 1) {
        e.preventDefault();
        this.closeTab(path);
        return;
      }
      if (target.classList.contains('tab-close')) {
        this.closeTab(path);
        return;
      }
      if (path !== this.app.activeTab) {
        this.setActiveTab(path);
      }
    });
  }

private ensureTabNodes(n: number) {
    const currentCount = this.tabsContainer.children.length;

    if (currentCount < n) {
      for (let i = currentCount; i < n; i++) {
        const tabEl = document.createElement('div');
        tabEl.className = 'tab';
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'tab-title';
        
        const closeSpan = document.createElement('span');
        closeSpan.className = 'tab-close';
        closeSpan.textContent = '×';

        tabEl.appendChild(titleSpan);
        tabEl.appendChild(closeSpan);
        this.tabsContainer.appendChild(tabEl);
      }
    } else if (currentCount > n) {
      for (let i = currentCount; i > n; i--) {
        this.tabsContainer.lastElementChild?.remove();
      }
    }
    this.tabPool = Array.from(this.tabsContainer.children) as HTMLElement[];
  }

  renderTabs() {
    this.treeView.render();
    
    const tabs = this.app.openTabs;
    const active = this.app.activeTab;

    this.ensureTabNodes(tabs.length);

    tabs.forEach((path, i) => {
      const el = this.tabPool[i];
      const titleSpan = el.querySelector('.tab-title') as HTMLElement;
      
      el.dataset.path = path;
      el.className = `tab ${path === active ? 'active' : ''}`;
      
      if (titleSpan.textContent !== path) {
        titleSpan.textContent = path;
      }
    });
  }
}
