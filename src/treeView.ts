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

    this.fileContainer = this.createFileContainer();
    this.container.appendChild(this.fileContainer);

    this.attachContainerEvents();
    this.render();
  }

  private createNewFileInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.className = 'tree-input tree-new-file';
    input.onkeydown = (e) => this.handleNewFileInputKeydown(e, input);
    input.onblur = () => this.handleNewFileInputBlur(input);
    return input;
  }

  private handleNewFileInputKeydown(e: KeyboardEvent, input: HTMLInputElement) {
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

  private handleNewFileInputBlur(input: HTMLInputElement) {
    input.classList.remove('visible');
    input.value = '';
  }

  private createFileContainer(): HTMLDivElement {
    const div = document.createElement('div');
    div.tabIndex = 0;
    return div;
  }

  private attachContainerEvents() {
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

  private createFileDiv(filePath: string, activeTab: string | null): HTMLDivElement {
    const fileDiv = document.createElement('div');
    fileDiv.className = `tree-file ${activeTab === filePath ? 'active' : ''}`;

    const fileLabel = document.createElement('input');
    fileLabel.setAttribute('readonly', 'true');
    fileLabel.className = 'tree-input';
    fileLabel.value = filePath;

    fileDiv.onclick = () => this.editor.openTab(filePath);
    fileLabel.ondblclick = () => fileLabel.removeAttribute('readonly');
    fileLabel.onkeydown = (e) => this.handleFileLabelKeydown(e, fileLabel, filePath);
    fileLabel.onblur = () => this.handleFileLabelBlur(fileLabel, filePath);

    fileDiv.appendChild(fileLabel);
    return fileDiv;
  }

  private handleFileLabelKeydown(e: KeyboardEvent, fileLabel: HTMLInputElement, filePath: string) {
    if (e.key === 'Enter') {
      const newPath = fileLabel.value.trim();
      if (newPath.length > 0 && newPath !== filePath && !this.app.exists(newPath)) {
        this.editor.closeTab(filePath);
        this.app.renameFile(filePath, newPath);
        this.editor.openTab(newPath);
        this.render();
      }
      fileLabel.blur();
    } else if (e.key === 'Escape') {
      fileLabel.blur();
    }
  }

  private handleFileLabelBlur(fileLabel: HTMLInputElement, filePath: string) {
    fileLabel.setAttribute('readonly', 'true');
    fileLabel.value = filePath;
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
      }
      const fileDiv = this.createFileDiv(filePath, activeTab);
      currentContainer!.appendChild(fileDiv);
    }
    if (currentContainer) {
      this.fileContainer.appendChild(currentContainer);
    }
  }
}
