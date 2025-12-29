import type { App } from "./app";
import type { Editor } from "./editor";

function partition(str: string, delimiter: string): [string, string] {
  const index = str.indexOf(delimiter);
  if (index === -1) {
    return [str, ""];
  }
  return [str.substring(0, index), str.substring(index + delimiter.length)];
}

export class FileTreeView {
  private container: HTMLElement;
  private fileContainer: HTMLElement;
  private app: App;
  private editor: Editor;
  private newFileInput: HTMLInputElement;
  private pool: HTMLElement[] = [];

  constructor(container: HTMLElement, app: App, editor: Editor) {
    this.container = container;
    this.app = app;
    this.editor = editor;

    this.container.tabIndex = 1;
    this.newFileInput = document.createElement("input");
    this.newFileInput.className = "tree-input tree-new-file";
    this.container.appendChild(this.newFileInput);

    this.fileContainer = document.createElement("div");
    this.fileContainer.tabIndex = 1;
    this.container.appendChild(this.fileContainer);

    this.bindEvents();
    this.render();
  }

  private bindEvents() {
    this.container.addEventListener("keydown", (e) => {
      if (e.code === "Space" && e.target !== this.newFileInput) {
        e.preventDefault();
        if (this.app.activeTab) {
          const parts = this.app.activeTab.split(".");
          if (parts.length > 0) {
            this.newFileInput.value = parts[0] + ".";
          }
        }
        this.newFileInput.classList.add("visible");
        this.newFileInput.focus();
      }
      if (e.code == "ArrowDown") {
        if (this.fileContainer.children.length > 0) {
          (this.fileContainer.children[0] as HTMLElement).focus();
        }
      }
      if (e.code == "ArrowUp") {
        const lastIndex = this.fileContainer.children.length - 1;
        if (lastIndex >= 0) {
          (this.fileContainer.children[lastIndex] as HTMLElement).focus();
        }
      }
    });
    this.newFileInput.addEventListener("blur", () => {
      this.newFileInput.classList.remove("visible");
      this.newFileInput.value = "";
    });
    this.container.addEventListener("keydown", (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("tree-input")) {
        const input = target as HTMLInputElement;

        if (e.key === "Enter") {
          if (target === this.newFileInput) {
            const fileName = this.newFileInput.value.trim();
            if (fileName && !this.app.exists(fileName)) {
              this.app.write(fileName, "", false);
              this.render();
            }
          } else if (target.classList.contains("tree-group-header")) {
            const oldGroup = input.dataset.group!;
            const newGroup = input.value.trim();
            if (newGroup && newGroup !== oldGroup) {
              this.app.renameGroup(oldGroup, newGroup);
              this.editor.reload();
              this.render();
            }
          } else if (target.classList.contains("tree-file")) {
            const oldPath =
              input.dataset.group! + "." + (input.dataset.file ?? "");
            const newPath = input.value.trim();
            if (newPath && newPath !== oldPath && !this.app.exists(newPath)) {
              this.app.renameFile(oldPath, newPath);
              this.editor.reload();
              this.render();
            }
          }
          input.parentElement?.focus();
        } else if (e.key === "Escape") {
          input.parentElement?.focus();
        }
        return;
      }
      if (target.classList.contains("tree-element")) {
        if (e.key === "Enter") {
          target.click();
        } else if (e.key === "ArrowUp") {
          const prev = target.previousElementSibling as HTMLElement;
          prev?.focus();
        } else if (e.key === "ArrowDown") {
          const next = target.nextElementSibling as HTMLElement;
          next?.focus();
        } else if (e.shiftKey && e.code == "Delete") {
          if (target.dataset.path) {
            const prev = target.previousElementSibling as HTMLElement;
            prev?.focus();
            this.app.deleteFile(target.dataset.path);
            this.editor.closeTab(target.dataset.path);
            this.render();
          }
        }
      }
    });
    this.fileContainer.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("tree-load-button")) {
        e.stopPropagation();
        this.app.loadShader(target.dataset.path!);
        return;
      }
      if (!e.altKey) {
        if (target.classList.contains("tree-group-toggle")) {
          this.app.toggleGroup(target.dataset.group!);
          this.render();
          return;
        }
        if (target.dataset.path) {
          this.editor.openTab(target.dataset.path);
          return;
        }
      }
    });
    this.fileContainer.addEventListener("keydown", (e) => {
      if (e.code === "KeyW" && e.altKey) {
        const input = (e.target as HTMLElement).querySelector(
          "input"
        ) as HTMLInputElement;
        if (input) {
          input.readOnly = false;
          input.focus();
        }
      }
    });
    this.fileContainer.addEventListener("focusin", (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("tree-file")) {
        const input = target as HTMLInputElement;
        input.value = input.dataset.group + "." + (input.dataset.file ?? "");
      }
    });
    this.fileContainer.addEventListener("focusout", (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("tree-file")) {
        const input = target as HTMLInputElement;
        input.readOnly = true;
        input.value = input.dataset.file ?? input.value;
      }
      if (target.classList.contains("tree-group-header")) {
        const input = target as HTMLInputElement;
        input.readOnly = true;
        input.value = input.dataset.group ?? input.value;
      }
    });
  }

  private ensureNodes(n: number) {
    const currentCount = this.fileContainer.children.length;

    if (currentCount < n) {
      for (let i = currentCount; i < n; i++) {
        const div = document.createElement("div");
        div.className = "tree-element";
        div.tabIndex = -1;

        const input = document.createElement("input");
        input.className = "tree-input";
        input.readOnly = true;
        input.spellcheck = false;

        const actionBtn = document.createElement("span");
        actionBtn.className = "tree-button";

        div.appendChild(input);
        div.appendChild(actionBtn);
        this.fileContainer.appendChild(div);
      }
    } else if (currentCount > n) {
      for (let i = currentCount; i > n; i--) {
        this.fileContainer.lastElementChild?.remove();
      }
    }
    this.pool = Array.from(this.fileContainer.children) as HTMLElement[];
  }

  render() {
    const files = this.app.listFiles().sort();
    const activeTab = this.app.activeTab;

    const visibleItems: Array<{
      type: "group" | "file";
      group: string;
      file?: string;
      active?: boolean;
    }> = [];

    let lastGroup: string | null = null;
    let isExpanded = false;

    for (const filePath of files) {
      const [group, fileName] = partition(filePath, ".");
      if (group !== lastGroup) {
        lastGroup = group;
        isExpanded = this.app.isGroupExpanded(group);
        visibleItems.push({ type: "group", group });
      }
      if (isExpanded) {
        visibleItems.push({
          type: "file",
          group,
          file: fileName,
          active: activeTab === filePath,
        });
      }
    }
    this.ensureNodes(visibleItems.length);

    visibleItems.forEach((item, i) => {
      const el = this.pool[i];
      const input = el.querySelector("input")!;
      const btn = el.querySelector("span")!;

      if (item.type === "group") {
        el.className = "tree-element tree-group-toggle";
        el.dataset.group = item.group;
        el.removeAttribute("data-path");

        input.className = "tree-input tree-group-header";
        input.value = item.group;
        input.dataset.group = item.group;

        btn.className = "tree-button tree-group-button";
        btn.textContent = this.app.isGroupExpanded(item.group) ? "▾" : "▸";
        btn.dataset.group = item.group;
      } else {
        const fullPath = `${item.group}.${item.file}`;
        el.className = `tree-element ${item.active ? "active" : ""}`;
        el.dataset.path = fullPath;
        el.removeAttribute("data-group");

        input.className = "tree-input tree-file";
        input.value = item.file!;
        input.dataset.group = item.group;
        input.dataset.file = item.file;

        btn.className = "tree-button tree-load-button";
        btn.textContent = ">";
        btn.dataset.path = fullPath;
      }
    });
  }
}
