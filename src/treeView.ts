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

    this.newFileInput = document.createElement('input');
    this.newFileInput.className = 'tree-input tree-new-file';

    const div = document.createElement('div');
    div.className = 'tree-element';
    div.appendChild(this.newFileInput);
    this.container.appendChild(div);

    this.fileContainer = document.createElement('div');
    this.fileContainer.tabIndex = 0;
    this.container.appendChild(this.fileContainer);

    this.bindEvents();
    this.render();
  }

  private bindEvents() {
    this.container.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && e.target !== this.newFileInput) {
        e.preventDefault();
        if (this.app.activeTab) {
          const parts = this.app.activeTab.split('.');
          if (parts.length > 0) {
            this.newFileInput.value = parts[0] + '.';
          }
        }
        this.newFileInput.classList.add('visible');
        this.newFileInput.focus();
      }
    });

    this.newFileInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const fileName = this.newFileInput.value.trim();
        if (fileName && !this.app.exists(fileName)) {
          this.app.write(fileName, '', false);
          this.render();
        }
        this.newFileInput.blur();
      } else if (e.key === 'Escape') {
        this.newFileInput.blur();
      }
    });

    this.newFileInput.addEventListener('blur', () => {
      this.newFileInput.classList.remove('visible');
      this.newFileInput.value = '';
    });

    this.fileContainer.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('tree-load-button')) {
        e.stopPropagation();
        this.app.loadFile(target.dataset.path!);
        return;
      }
      if (target.classList.contains('tree-group-toggle')) {
        this.app.toggleGroup(target.dataset.group!);
        this.render();
        return;
      }
      if (target.dataset.path) {
        this.editor.openTab(target.dataset.path);
        return;
      }
    });

    this.fileContainer.addEventListener('keydown', (e) => {
      const target = e.target as HTMLElement;
      if (e.code === 'KeyW' && e.altKey) {
        const input = (e.target as HTMLElement).querySelector('input') as HTMLInputElement;
        if (input) {
          input.readOnly = false;
          input.focus();
        }
      }

      if (target.classList.contains('tree-file')) {
        const input = target as HTMLInputElement;
        const element = input.closest('.tree-element') as HTMLElement;
        const oldPath = element.dataset.path!;

        if (e.key === 'Enter') {
          const newPath = input.value.trim();
          if (newPath && newPath !== oldPath && !this.app.exists(newPath)) {
            this.app.renameFile(oldPath, newPath);
            this.editor.reload();
            this.render();
          }
          input.blur();
        } else if (e.key === 'Escape') {
          input.blur();
        }
        return;
      }
    });

    this.fileContainer.addEventListener('focusin', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('tree-file')) {
        const input = target as HTMLInputElement;
        input.value = input.dataset.group + '.' + (input.dataset.file ?? '');
      }
    });

    this.fileContainer.addEventListener('focusout', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('tree-file')) {
        const input = target as HTMLInputElement;
        input.readOnly = true;
        input.value = input.dataset.file ?? input.value;
      }
      if (target.classList.contains('tree-group-header')) {
        const input = target as HTMLInputElement;
        input.readOnly = true;
        input.value = input.dataset.group ?? input.value;
      }
    });
  }

  private createGroupHeader(groupName: string, isExpanded: boolean): HTMLElement {
    const div = document.createElement('div');
    div.className = 'tree-element tree-group-toggle';
    div.tabIndex = 0;
    div.dataset.group = groupName;

    const input = document.createElement('input');
    input.className = 'tree-input tree-group-header';
    input.dataset.group = groupName;
    input.value = groupName;
    input.readOnly = true;
    input.spellcheck = false;

    const expandBtn = document.createElement('span');
    expandBtn.className = 'tree-button tree-group-button';
    expandBtn.textContent = isExpanded ? '▾' : '▸';

    div.appendChild(input);
    div.appendChild(expandBtn);
    return div;
  }

  private createFileElement(groupName: string, fileName: string, isActive: boolean): HTMLElement {
    const div = document.createElement('div');
    div.className = 'tree-element ' + (isActive ? 'active' : '');
    div.tabIndex = 0;
    div.dataset.path = groupName + '.' + fileName;

    const input = document.createElement('input');
    input.className = 'tree-input tree-file';
    input.dataset.group = groupName;
    input.dataset.file = fileName;
    input.value = fileName;
    input.readOnly = true;
    input.spellcheck = false;

    const loadBtn = document.createElement('span');
    loadBtn.className = 'tree-button tree-load-button';
    loadBtn.dataset.path = groupName + '.' + fileName;
    loadBtn.textContent = '>';

    div.appendChild(input);
    div.appendChild(loadBtn);
    return div;
  }

  render() {
    this.fileContainer.innerHTML = '';
    const files = this.app.listFiles().sort();

    var lastGroup = null;
    var isExpanded = false;
    for (const filePath of files) {
      const [group, fileName] = filePath.split('.', 2);
      if (group !== lastGroup) {
        lastGroup = group;
        isExpanded = this.app.isGroupExpanded(lastGroup!);
        this.fileContainer.appendChild(this.createGroupHeader(group, isExpanded));
      }
      if (isExpanded) {
        this.fileContainer.appendChild(this.createFileElement(group, fileName, this.app.activeTab === filePath));
      }
    }
  }
}
