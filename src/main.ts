import './style.css'

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
import { InputManager } from './inputManager'
import { linter, type Diagnostic } from '@codemirror/lint'
import { search, searchKeymap } from '@codemirror/search'

const sampleShader = `
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord * 2.0 - iResolution) / iResolution.y;
  fragColor = vec4(uv, 0.5, 1.0);
}
`;

const savedCode = localStorage.getItem("glsl-code") || sampleShader;

const extensions = [
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
  search({
    top: true,
  }),
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
  }),
  EditorView.updateListener.of(update => {
    if (update.docChanged) {
      localStorage.setItem("glsl-code", update.state.doc.toString());

      const code = update.state.doc.toString();
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
      if (!hasError) {
        renderer.compileAndStart(code);
      }
    }
  })
];

// Create the editor state
let editorState = EditorState.create({
  doc: savedCode,
  extensions: extensions
});

const editorContainer = document.getElementById("editor-container")!;
const canvasContainer = document.getElementById("canvas-container")!;
const editor = document.getElementById("editor")!;

const view = new EditorView({
  state: editorState,
  parent: editor
});

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const errorsDiv = document.getElementById("errors") as HTMLDivElement;
const statusDiv = document.getElementById("status") as HTMLDivElement;

const inputManager = new InputManager();
const renderer = new GLSLRenderer(canvas, errorsDiv, statusDiv, inputManager);

const code = view.state.doc.toString();
renderer.compileAndStart(code);

var editorShown = true;

function showEditor(shown: boolean) {
  editorShown = shown;
  if (editorShown) {
    editorContainer.style.display = "";
  } else {
    editorContainer.style.display = "none";
  }
}

window.addEventListener("keydown", async (e) => {
  if (e.code == "AltLeft") {
    e.preventDefault();
  }
  if (e.code == "KeyR" && e.altKey) {
    showEditor(!editorShown);
    if (editorShown) {
      view.focus();
    }
    e.preventDefault();
  }
  if (e.code == "KeyQ" && e.altKey) {
    canvasContainer.classList.toggle("canvas-aspect");
    canvasContainer.classList.toggle("canvas-max");
    e.preventDefault();
  }
  if (e.code == "KeyF" && e.altKey) {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      showEditor(true);
      view.focus();
    } else {
      await canvasContainer.requestFullscreen();
    }
    e.preventDefault();
  }
});

document.addEventListener('mousedown', e => {
  if (!editorContainer.contains(e.target as Node)) {
    e.preventDefault();
  }
});

function resizeCanvas() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}

resizeCanvas();

var isResizing = false;
const resizeObserver = new ResizeObserver(() => {
  if (!isResizing) {
    resizeCanvas();
  }
});
resizeObserver.observe(canvas);

const resizer = document.getElementById("resizer")!;

resizer.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  document.body.style.cursor = "col-resize";
  document.addEventListener("mousemove", resize);
  document.addEventListener("mouseup", stopResize);
  isResizing = true;
});

function resize(e: MouseEvent) {
  const minWidth = window.innerWidth * 0.2;
  const maxWidth = window.innerWidth - 200;
  let newWidth = e.clientX;
  newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
  editorContainer.style.width = `${newWidth}px`;
}

function stopResize(e: MouseEvent) {
  if (e.button !== 0) return;
  document.body.style.cursor = "";
  document.removeEventListener("mousemove", resize);
  document.removeEventListener("mouseup", stopResize);
  isResizing = false;
  resizeCanvas();
}
