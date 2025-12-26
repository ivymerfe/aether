import type { App } from './app';
import type { Editor } from './editor';

interface FileGroup {
  container: HTMLDivElement;
  button: HTMLSpanElement;
  header: HTMLDivElement;
  files: Map<string, HTMLDivElement>;
}

export class FileTreeView {
  private container: HTMLElement;
  private fileContainer: HTMLElement;
  private app: App;
  private editor: Editor;
  private newFileInput: HTMLInputElement;
  private cachedGroups: Map<string, FileGroup> = new Map();
  private lastActiveTab: string | null = null;

  constructor(container: HTMLElement, app: App, editor: Editor) {
    this.container = container;
    this.app = app;
    this.editor = editor;

    this.newFileInput = this.createNewFileInput();
    const div = document.createElement('div');
    div.className = 'tree-element';
    div.appendChild(this.newFileInput)
    this.container.appendChild(div);

    this.fileContainer = document.createElement('div');
    this.fileContainer.tabIndex = 0;
    this.container.appendChild(this.fileContainer);

    this.container.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        if (this.app.activeTab) {
          const group = this.app.activeTab.split('.')[0];
          this.newFileInput.value = group + '.';
        }
        this.newFileInput.classList.add('visible');
        this.newFileInput.focus();
        e.preventDefault();
      }
    });
    this.render();
  }

  private createNewFileInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.className = 'tree-input tree-new-file';
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const fileName = input.value.trim();
        if (fileName.length > 0 && !this.app.exists(fileName)) {
          this.app.write(fileName, '', false);
          this.render();
        }
        input.blur();
      } else if (e.key === 'Escape') {
        input.blur();
      }
    }
    input.onblur = () => {
      input.classList.remove('visible');
      input.value = '';
    };
    return input;
  }

  private createFileGroup(group: string): FileGroup {
    const container = document.createElement('div');
    container.className = 'tree-group';

    const button = document.createElement('span');
    button.className = 'tree-button tree-group-button';
    button.onclick = (e) => {
      e.stopPropagation();
      const isExpanded = container.classList.contains('expanded');
      container.classList.toggle('expanded');
      button.textContent = isExpanded ? '+' : '-';
      this.app.toggleGroup(group);
    };
    container.appendChild(button);

    const header = document.createElement('div');
    header.className = 'tree-element';
    header.tabIndex = 0;

    const groupInput = document.createElement('input');
    groupInput.setAttribute('readonly', 'true');
    groupInput.setAttribute('spellcheck', 'false');
    groupInput.className = 'tree-input tree-group-header';
    groupInput.value = group;

    header.onclick = () => {
      const isExpanded = container.classList.contains('expanded');
      container.classList.toggle('expanded');
      button.textContent = isExpanded ? '+' : '-';
      this.app.toggleGroup(group);
    };
    header.ondblclick = () => {
      groupInput.removeAttribute('readonly');
      groupInput.focus();
    }
    header.onkeydown = (e) => {
      if (e.code === 'KeyW' && e.altKey) {
        groupInput.removeAttribute('readonly');
        groupInput.focus();
      }
    };
    groupInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const newGroup = groupInput.value.trim();
        if (newGroup.length > 0 && newGroup !== group && !this.app.exists(newGroup)) {
          this.app.renameGroup(group, newGroup);
          this.editor.reload();
          this.render();
        }
        groupInput.blur();
      } else if (e.key === 'Escape') {
        groupInput.blur();
      }
    }
    groupInput.onblur = () => {
      groupInput.setAttribute('readonly', 'true');
      groupInput.value = group;
    };
    header.appendChild(groupInput);
    container.appendChild(header);

    return {
      container,
      button,
      header,
      files: new Map()
    };
  }

  private createFileElement(filePath: string): HTMLDivElement {
    const div = document.createElement('div');
    div.className = 'tree-element';
    div.tabIndex = 0;

    const fileName = filePath.split('.').slice(1).join('.');

    const fileInput = document.createElement('input');
    fileInput.setAttribute('readonly', 'true');
    fileInput.setAttribute('spellcheck', 'false');
    fileInput.className = 'tree-input tree-file';
    fileInput.value = fileName;

    div.onclick = () => {
      this.editor.openTab(filePath);
    }
    div.ondblclick = () => {
      fileInput.removeAttribute('readonly');
      fileInput.value = filePath;
      fileInput.focus();
    }
    div.onkeydown = (e) => {
      if (e.code === 'KeyW' && e.altKey) {
        fileInput.removeAttribute('readonly');
        fileInput.value = filePath;
        fileInput.focus();
      }
    };
    fileInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const newPath = fileInput.value.trim();
        if (newPath.length > 0 && newPath !== filePath && !this.app.exists(newPath)) {
          this.app.renameFile(filePath, newPath);
          this.editor.reload();
          this.render();
        }
        fileInput.blur();
      } else if (e.key === 'Escape') {
        fileInput.blur();
      }
    }
    fileInput.onblur = () => {
      fileInput.setAttribute('readonly', 'true');
      fileInput.value = fileName;
    }
    const loadButton = document.createElement('span');
    loadButton.className = 'tree-button tree-load-button';
    loadButton.textContent = '>';
    loadButton.onclick = (e) => {
      e.stopPropagation();
      this.app.loadFile(filePath);
    }

    div.appendChild(fileInput);
    div.appendChild(loadButton);
    return div;
  }

  updateActiveTab() {
    const activeTab = this.app.activeTab;
    if (activeTab === this.lastActiveTab) return;

    if (this.lastActiveTab) {
      const prevGroup = this.lastActiveTab.split('.')[0];
      const prevCachedGroup = this.cachedGroups.get(prevGroup);
      const prevFileInput = prevCachedGroup?.files.get(this.lastActiveTab);
      prevFileInput?.classList.remove('active');
    }
    if (activeTab) {
      const group = activeTab.split('.')[0];
      const cachedGroup = this.cachedGroups.get(group);
      const fileInput = cachedGroup?.files.get(activeTab);
      fileInput?.classList.add('active');
    }

    this.lastActiveTab = activeTab;
  }

  render() {
    const files = this.app.listFiles().sort();
    const fileGroups = new Map<string, string[]>();
    for (const filePath of files) {
      const group = filePath.split('.')[0];
      if (!fileGroups.has(group)) {
        fileGroups.set(group, []);
      }
      fileGroups.get(group)!.push(filePath);
    }
    for (const [group, cachedGroup] of this.cachedGroups) {
      if (!fileGroups.has(group)) {
        cachedGroup.container.remove();
        this.cachedGroups.delete(group);
      }
    }
    for (const [group, groupFiles] of fileGroups) {
      let cachedGroup = this.cachedGroups.get(group);

      if (!cachedGroup) {
        cachedGroup = this.createFileGroup(group);
        this.cachedGroups.set(group, cachedGroup);
        this.fileContainer.appendChild(cachedGroup.container);
      }
      const expanded = this.app.isGroupExpanded(group);
      cachedGroup.container.className = `tree-group ${expanded ? 'expanded' : ''}`;
      cachedGroup.button.textContent = expanded ? '-' : '+';
      for (const [filePath, fileInput] of cachedGroup.files) {
        if (!groupFiles.includes(filePath)) {
          fileInput.remove();
          cachedGroup.files.delete(filePath);
        }
      }
      for (const filePath of groupFiles) {
        let fileInput = cachedGroup.files.get(filePath);
        if (!fileInput) {
          fileInput = this.createFileElement(filePath);
          cachedGroup.files.set(filePath, fileInput);
          cachedGroup.container.appendChild(fileInput);
        }
      }
    }
    this.updateActiveTab();
  }
}
