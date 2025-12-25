import { EditorState } from "@codemirror/state"
import { drawSelection, EditorView, highlightActiveLine, keymap } from "@codemirror/view"
import { defaultKeymap, history, redo } from "@codemirror/commands"
import { glsl } from "./glsl-lang/glsl"
import { vsCodeDark } from './theme'
import { lineNumbers } from "@codemirror/view"
import { indentWithTab } from "@codemirror/commands"
import { indentationMarkers } from './indent-markers'
import { indentOnInput, indentUnit, syntaxTree } from "@codemirror/language"
import { GLSLRenderer } from './renderer'
import { linter, type Diagnostic } from '@codemirror/lint'
import { search, searchKeymap } from '@codemirror/search'
import { FileTreeView } from './treeView'
import { StateManager } from './stateManager'

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

export class Editor {
  private view: EditorView;
  private stateManager: StateManager;
  private tabsContainer: HTMLElement;
  private treeView: FileTreeView;
  private renderer: GLSLRenderer;

  constructor(
    editorContainer: HTMLElement,
    tabsContainer: HTMLElement,
    treeContainer: HTMLElement,
    stateManager: StateManager,
    renderer: GLSLRenderer
  ) {
    this.stateManager = stateManager;
    this.tabsContainer = tabsContainer;
    this.renderer = renderer;

    this.view = new EditorView({
      parent: editorContainer
    });

    const updateListener = EditorView.updateListener.of(update => {
      if (update.docChanged) {
        const active = this.stateManager.activeTab;
        if (active) {
          const content = update.state.doc.toString();
          this.stateManager.writeFile(active, content);
          this.checkAndCompile(update.state, content);
        }
      }
    });

    // Reconfigure extensions to include the listener
    // this.view.dispatch({
    //   effects: EditorState.appendExtension.of(updateListener)
    // });

    // Initialize Tree View
    this.treeView = new FileTreeView(treeContainer, stateManager, (path) => {
      this.openFile(path);
    });

    // Initial Load
    this.renderTabs();
    const active = this.stateManager.activeTab;
    if (active) {
      this.loadFileIntoEditor(active);
    }
  }

  private checkAndCompile(state: EditorState, content: string) {
    const tree = syntaxTree(state);
    let hasError = false;
    tree.iterate({
      enter: (node) => {
        if (node.type.isError) {
          hasError = true;
          return false;
        }
      }
    });
    if (!hasError) {
      this.renderer.compileAndStart(content);
    }
  }

  openFile(path: string) {
    this.stateManager.openTab(path);
    this.loadFileIntoEditor(path);
    this.renderTabs();
    this.treeView.render();
  }

  closeFile(path: string) {
    this.stateManager.closeTab(path);
    const newActive = this.stateManager.activeTab;
    if (newActive) {
      this.loadFileIntoEditor(newActive);
    } else {
      this.view.setState(EditorState.create({ doc: "", extensions: EXTENSIONS }));
    }
    this.renderTabs();
    this.treeView.render();
  }

  private loadFileIntoEditor(path: string) {
    const content = this.stateManager.getFile(path);
    if (content !== null) {
      const newState = EditorState.create({
        doc: content,
        extensions: EXTENSIONS
      });
      this.view.setState(newState);
      this.checkAndCompile(newState, content);
    }
  }

  renderTabs() {
    this.tabsContainer.innerHTML = '';
    const tabs = this.stateManager.openTabs;
    const active = this.stateManager.activeTab;

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
        this.closeFile(path);
      };
      tabEl.appendChild(closeSpan);

      tabEl.onclick = () => {
        if (path !== active) {
          this.stateManager.setActiveTab(path);
          this.loadFileIntoEditor(path);
          this.renderTabs();
          this.treeView.render();
        }
      };

      this.tabsContainer.appendChild(tabEl);
    });
  }
}
