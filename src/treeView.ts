import type { App } from './app';

export class FileTreeView {
  private container: HTMLElement;
  private stateManager: App;
  private onFileSelect: (path: string) => void;

  constructor(container: HTMLElement, stateManager: App, onFileSelect: (path: string) => void) {
    this.container = container;
    this.stateManager = stateManager;
    this.onFileSelect = onFileSelect;
    this.render();
  }

  render() {
    this.container.innerHTML = '';
    const files = this.stateManager.listFiles();
    let childrenContainer: HTMLDivElement | null = null;
    let activeTab = this.stateManager.activeTab;
    for (const filePath of files) {
      const [project, file] = filePath.split('.');
      const isMain = file === 'main';

      if (isMain) {
        if (childrenContainer) {
          this.container.appendChild(childrenContainer);
        }
        let isExpanded = this.stateManager.expandedProjects.has(project);
        childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-children ' + (isExpanded ? ' expanded' : '');

        const projectDiv = document.createElement('div');
        projectDiv.className = `tree-item tree-project ${activeTab === filePath ? 'active' : ''}`;

        const arrow = document.createElement('span');
        arrow.className = `tree-arrow ${isExpanded ? 'expanded' : ''}`;
        arrow.textContent = '▶';
        arrow.onclick = (e) => {
          e.stopPropagation();
          this.stateManager.toggleProjectExpansion(project!);
          arrow.classList.toggle('expanded');
          if (childrenContainer) {
            childrenContainer.classList.toggle('expanded');
          }
        };
        projectDiv.appendChild(arrow);

        const label = document.createElement('span');
        label.className = 'tree-label';
        label.textContent = project;
        projectDiv.onclick = () => this.onFileSelect(filePath);
        projectDiv.appendChild(label);

        this.container.appendChild(projectDiv);

      } else if (childrenContainer) {
        const fileDiv = document.createElement('div');
        fileDiv.className = `tree-item tree-file ${activeTab === filePath ? 'active' : ''}`;

        const fileLabel = document.createElement('span');
        fileLabel.className = 'tree-label';
        fileLabel.textContent = file;

        fileDiv.onclick = () => this.onFileSelect(filePath);
        fileDiv.appendChild(fileLabel);
        childrenContainer.appendChild(fileDiv);
      }
    }
    if (childrenContainer) {
      this.container.appendChild(childrenContainer);
    }
  }
}
