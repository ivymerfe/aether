import './styles/base.css'
import './styles/canvas.css'
import './styles/editor.css'
import './styles/top.css'
import './styles/treeView.css'

import { App } from './app'
import { Editor } from './editor'

const editorPanel = document.getElementById("editor-panel")!;
const editorDiv = document.getElementById("editor")!;
const tabsDiv = document.getElementById("tabs-container")!;
const treeViewDiv = document.getElementById("tree-view")!;
const errorsDiv = document.getElementById("errors")! as HTMLDivElement;
const statusDiv = document.getElementById("status")! as HTMLDivElement;
const canvasContainer = document.getElementById("canvas-container")!;
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const sidebarToggle = document.getElementById("sidebar-toggle")!;

const app = new App(canvas, errorsDiv, statusDiv);
const editor = new Editor(app, editorDiv, tabsDiv, treeViewDiv);

function updateSidebarVisibility() {
    const isOpen = app.isSidebarOpen;
    if (isOpen) {
        treeViewDiv.classList.add('visible');
        sidebarToggle.textContent = '◀';
    } else {
        treeViewDiv.classList.remove('visible');
        sidebarToggle.textContent = '▶';
    }
}

sidebarToggle.onclick = () => {
    app.setSidebarOpen(!app.isSidebarOpen);
    updateSidebarVisibility();
};
updateSidebarVisibility();

var editorShown = true;
function showEditor(shown: boolean) {
  editorShown = shown;
  editorPanel.style.display = editorShown ? "" : "none";
  if (shown) {
    editor.view.focus();
  }
}

window.addEventListener("keydown", async (e) => {
  if (e.code == "AltLeft") e.preventDefault();
  
  if (e.code == "KeyR" && e.altKey) {
    showEditor(!editorShown);
    e.preventDefault();
  }
  
  if (e.code == "KeyQ" && e.altKey) {
    canvasContainer.classList.toggle("canvas-aspect");
    canvasContainer.classList.toggle("canvas-max");
    resizeCanvas();
    e.preventDefault();
  }
  
  if (e.code == "KeyF" && e.altKey) {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      showEditor(true);
      app.inputManager.setInputLock(false);
    } else {
      await canvasContainer.requestFullscreen();
      await canvas.requestPointerLock();
      app.inputManager.setInputLock(true);
    }
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
  editorPanel.style.width = `${newWidth}px`;
}

function stopResize() {
  document.body.style.cursor = "";
  document.removeEventListener("mousemove", resize);
  document.removeEventListener("mouseup", stopResize);
  isResizing = false;
  resizeCanvas();
}
