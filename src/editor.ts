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
  private view: EditorView;
  private app: App;
  private tabsContainer: HTMLElement;
  private treeView: FileTreeView;
  private extensions: Extension[];
  private loadedFiles: Record<string, EditorState> = {};

  constructor(editorContainer: HTMLElement, tabsContainer: HTMLElement, treeContainer: HTMLElement, app: App) {
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

    this.treeView = new FileTreeView(treeContainer, app, this);

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

  renderTabs() {
    this.tabsContainer.innerHTML = '';
    const tabs = this.app.openTabs;
    const active = this.app.activeTab;

    tabs.forEach(path => {
      const tabEl = document.createElement('div');
      tabEl.className = `tab ${path === active ? 'active' : ''}`;

      const title = path;

      const titleSpan = document.createElement('span');
      titleSpan.className = 'tab-title';
      titleSpan.textContent = title;
      tabEl.appendChild(titleSpan);

      const closeSpan = document.createElement('span');
      closeSpan.className = 'tab-close';
      closeSpan.textContent = '×';
      closeSpan.onclick = (e) => {
        e.stopPropagation();
        this.closeTab(path);
      };
      tabEl.appendChild(closeSpan);

      tabEl.onclick = () => {
        if (path !== active) {
          this.setActiveTab(path);
        }
      };
      this.tabsContainer.appendChild(tabEl);
    });
  }
}
