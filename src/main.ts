import './style.css'

import { EditorState } from "@codemirror/state"
import { EditorView, highlightActiveLine, keymap } from "@codemirror/view"
import { defaultKeymap, history, redo } from "@codemirror/commands"
import { glsl } from "./glsl-lang/glsl"
import { vsCodeDark } from './theme'
import { lineNumbers } from "@codemirror/view"
import { indentWithTab } from "@codemirror/commands"
import { indentationMarkers } from './indent-markers'
import { indentOnInput, indentUnit } from "@codemirror/language"
import { GLSLRenderer } from './renderer'

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
      }
    })
  ]
});

var appShown = true;
let app = document.getElementById("app")!;
let editor = document.getElementById("editor")!;

let view = new EditorView({
  state: editorState,
  parent: editor
});

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const errorsDiv = document.getElementById("errors") as HTMLDivElement;
const statusDiv = document.getElementById("status") as HTMLDivElement;

const renderer = new GLSLRenderer(canvas, errorsDiv, statusDiv);
const code = view.state.doc.toString();
renderer.compileAndStart(code);

var suppressAlt = false;

window.addEventListener("keydown", (e) => {
  if (e.altKey && !e.repeat) {
    if (e.code === "KeyW") {
      app.style.display = "none";
      appShown = false;
      suppressAlt = true;
      canvas.focus();
    }
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key == "Alt") {
    if (suppressAlt) {
      suppressAlt = false;
      return;
    }
    if (!appShown) {
      app.style.display = "";
      appShown = true;
      view.focus();
      document.exitPointerLock();
      return;
    }
    if (!view.hasFocus) {
      view.focus();
      return;
    }
    const code = view.state.doc.toString();
    renderer.compileAndStart(code);
  }
});

const resizer = document.getElementById("resizer")!;

resizer.addEventListener("mousedown", (e) => {
  e.preventDefault();
  document.body.style.cursor = "col-resize";
  document.addEventListener("mousemove", resize);
  document.addEventListener("mouseup", stopResize);
});

function resize(e: MouseEvent) {
  const minWidth = window.innerWidth * 0.2;
  const maxWidth = window.innerWidth - 200;
  let newWidth = window.innerWidth - e.clientX;
  newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
  app.style.width = `${newWidth}px`;
}

function stopResize() {
  document.body.style.cursor = "";
  document.removeEventListener("mousemove", resize);
  document.removeEventListener("mouseup", stopResize);
}
