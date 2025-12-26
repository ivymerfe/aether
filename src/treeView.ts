import type { App } from './app';
import type { Editor } from './editor';

export class FileTreeView {
  private container: HTMLElement;
  private fileContainer: HTMLElement;
  private app: App;
  private editor: Editor;
  private newFileInput: HTMLInputElement;

  constructor(container: HTMLElement, app: App, editor: Editor) {
    this.container = container;
    this.app = app;
    this.editor = editor;

    this.newFileInput = this.createNewFileInput();
    this.container.appendChild(this.newFileInput);

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

  private createGroupContainer(group: string, expanded: boolean): HTMLDivElement {
    const groupContainer = document.createElement('div');
    groupContainer.className = 'tree-group ' + (expanded ? 'expanded' : '');

    const groupButton = document.createElement('span');
    groupButton.className = 'tree-group-button';
    groupButton.textContent = expanded ? '-' : '+';
    groupButton.onclick = () => {
      const isExpanded = groupContainer.classList.contains('expanded');
      groupContainer.classList.toggle('expanded');
      groupButton.textContent = isExpanded ? '+' : '-';
      this.app.toggleGroup(group);
    };
    groupContainer.appendChild(groupButton);

    return groupContainer;
  }

  private createGroupHeader(group: string): HTMLInputElement {
    const groupInput = document.createElement('input');
    groupInput.setAttribute('readonly', 'true');
    groupInput.className = 'tree-input tree-group-header';
    groupInput.value = group;

    groupInput.ondblclick = () => groupInput.removeAttribute('readonly');
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
    return groupInput
  }

  private createFileInput(filePath: string, activeTab: string | null): HTMLInputElement {
    const fileName = filePath.split('.').slice(1).join('.');

    const fileInput = document.createElement('input');
    fileInput.setAttribute('readonly', 'true');
    fileInput.className = 'tree-input tree-file ' + (filePath === activeTab ? 'active' : '');
    fileInput.value = fileName;

    fileInput.onclick = () => this.editor.openTab(filePath);
    fileInput.ondblclick = () => {
      fileInput.removeAttribute('readonly');
      fileInput.value = filePath;
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
    return fileInput;
  }

  render() {
    this.fileContainer.innerHTML = '';
    const files = this.app.listFiles().sort();
    const activeTab = this.app.activeTab;
    let currentContainer: HTMLDivElement | null = null;
    let lastGroup = null;

    for (const filePath of files) {
      const group = filePath.split('.')[0];
      if (group !== lastGroup) {
        lastGroup = group;
        if (currentContainer) {
          this.fileContainer.appendChild(currentContainer);
        }
        const expanded = this.app.isGroupExpanded(group);
        currentContainer = this.createGroupContainer(group, expanded);
        const groupDiv = this.createGroupHeader(group);
        currentContainer.appendChild(groupDiv);
      }
      const fileDiv = this.createFileInput(filePath, activeTab);
      currentContainer!.appendChild(fileDiv);
    }
    if (currentContainer) {
      this.fileContainer.appendChild(currentContainer);
    }
  }
}
