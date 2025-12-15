import './style.css'

import { EditorState } from "@codemirror/state"
import { EditorView, highlightActiveLine, keymap } from "@codemirror/view"
import { defaultKeymap, history, redo } from "@codemirror/commands"
import { glsl } from "./glsl-lang/glsl"
import { vsCodeDark } from './theme'
import { lineNumbers } from "@codemirror/view"
import { indentWithTab } from "@codemirror/commands"
import { indentationMarkers } from './indent-markers'
import { indentOnInput, indentUnit, syntaxTree } from "@codemirror/language"
import { GLSLRenderer } from './renderer'
import { InputManager } from './inputManager'

const sampleShader = `
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord * 2.0 - iResolution) / iResolution.y;
  fragColor = vec4(uv, 0.5, 1.0);
}
`;

const savedCode = localStorage.getItem("glsl-code") || sampleShader;

// Create the editor state
let editorState = EditorState.create({
  doc: savedCode,
  extensions: [
    lineNumbers(),
    keymap.of([
      ...defaultKeymap,
      indentWithTab,
      { key: "Ctrl-Shift-z", run: redo }
    ]),
    EditorState.tabSize.of(4),
    indentUnit.of("    "),
    history({}),
    glsl(),
    vsCodeDark,
    highlightActiveLine(),
    indentationMarkers(),
    indentOnInput(),
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
            }
          }
        });
        if (!hasError) {
          renderer.compileAndStart(code);
        }
      }
    })
  ]
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

var lastKey = "";
var editorShown = true;

function showEditor(shown: boolean) {
  editorShown = shown;
  if (editorShown) {
    editorContainer.style.display = "";
  } else {
    editorContainer.style.display = "none";
  }
}

window.addEventListener("keydown", (e) => {
  if (e.code == "AltLeft") {
    e.preventDefault();
  }
  if (e.code == "KeyF" && e.altKey) {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      showEditor(true);
    } else {
      canvasContainer.requestFullscreen();
      canvas.focus();
    }
    e.preventDefault();
  }
  lastKey = e.code;
});

canvas.addEventListener("keydown", (e) => {
  if (e.code == "KeyF") {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      showEditor(true);
    } else {
      showEditor(!editorShown);
    }
  }
});

window.addEventListener("keyup", async (e) => {
  if (e.code == "AltLeft" && lastKey == "AltLeft") {
    if (view.hasFocus) {
      canvas.focus();
    } else {
      showEditor(true);
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      view.focus();
    }
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

function stopResize() {
  document.body.style.cursor = "";
  document.removeEventListener("mousemove", resize);
  document.removeEventListener("mouseup", stopResize);
  isResizing = false;
  resizeCanvas();
}
