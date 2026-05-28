/* =====================================================================
   APP: FILE STATION - EXPLORADOR DE ARCHIVOS INTERACTIVO
   ===================================================================== */

class FileStation {
  constructor() {
    this.currentPath = '';
    this.selectedItem = null;
    this.win = null;
  }

  init(win) {
    this.win = win;
    this.currentPath = '';
    this.selectedItem = null;
    
    this.bindEvents();
    this.loadDirectory('');
  }

  bindEvents() {
    // Botón Nueva Carpeta
    this.win.querySelector('#file-btn-newfolder').addEventListener('click', () => {
      const folderName = prompt('Ingrese el nombre de la nueva carpeta:');
      if (folderName) {
        this.createFolder(folderName);
      }
    });

    // Botón Crear Archivo (Simula Subida)
    this.win.querySelector('#file-btn-upload').addEventListener('click', () => {
      const fileName = prompt('Ingrese el nombre del archivo (ej. notas.txt):');
      if (fileName) {
        const fileContent = prompt('Ingrese el contenido del archivo de texto:', 'Creado desde el NAS...');
        if (fileContent !== null) {
          this.createFile(fileName, fileContent);
        }
      }
    });

    // Botón Eliminar
    this.win.querySelector('#file-btn-delete').addEventListener('click', () => {
      if (!this.selectedItem) {
        alert('Por favor, seleccione primero un elemento de la lista.');
        return;
      }
      const confirmDelete = confirm(`¿Está seguro de que desea eliminar permanentemente "${this.selectedItem.name}"?`);
      if (confirmDelete) {
        this.deleteItem(this.selectedItem.path);
      }
    });

    // Clic en la carpeta raíz de la barra lateral
    this.win.querySelector('.folder-tree-item').addEventListener('click', (e) => {
      this.win.querySelectorAll('.folder-tree-item').forEach(el => el.classList.remove('active'));
      e.currentTarget.classList.add('active');
      this.loadDirectory('');
    });
  }

  // A. Cargar lista de archivos
  async loadDirectory(pathString) {
    try {
      this.currentPath = pathString;
      this.selectedItem = null;
      
      // Actualizar barra de ruta
      const pathDisplay = this.win.querySelector('#file-path-display');
      pathDisplay.textContent = `/shares/${pathString}`;
      
      const res = await fetch(`${window.location.origin}/api/files/list?path=${encodeURIComponent(pathString)}`);
      const data = await res.json();
      
      if (!data.success) {
        alert('Error: ' + data.message);
        return;
      }
      
      this.renderFiles(data.items);
      this.renderSidebarSubfolders(data.items);
    } catch (e) {
      console.error('Error al cargar directorio:', e);
    }
  }

  renderFiles(items) {
    const grid = this.win.querySelector('#file-view-grid');
    grid.innerHTML = '';

    // Si no estamos en la raíz, añadir opción para volver atrás
    if (this.currentPath !== '') {
      const parentDirItem = document.createElement('div');
      parentDirItem.className = 'file-item';
      parentDirItem.innerHTML = `
        <div class="file-icon file-icon-dir">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
        </div>
        <span class="file-name">.. (Volver)</span>
      `;
      
      parentDirItem.addEventListener('dblclick', () => {
        const parts = this.currentPath.split('/');
        parts.pop(); // quitar último elemento
        this.loadDirectory(parts.join('/'));
      });
      
      grid.appendChild(parentDirItem);
    }

    if (items.length === 0 && this.currentPath === '') {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--syno-text-muted); margin-top: 40px; font-size:12px;">Carpeta vacía. Utilice "Nueva Carpeta" o "Crear Archivo" arriba.</div>`;
      return;
    }

    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'file-item';
      
      // Elegir icono
      const icon = item.isDirectory 
        ? `<svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor" class="file-icon-dir"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`
        : `<svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor" class="file-icon-file"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`;
      
      el.innerHTML = `
        <div class="file-icon">${icon}</div>
        <span class="file-name" title="${item.name}">${item.name}</span>
      `;

      // Seleccionar elemento
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.win.querySelectorAll('.file-item').forEach(itemEl => itemEl.classList.remove('active'));
        el.classList.add('active');
        this.selectedItem = item;
      });

      // Navegar si es directorio
      el.addEventListener('dblclick', () => {
        if (item.isDirectory) {
          this.loadDirectory(item.path);
        } else {
          alert(`Información del Archivo:\nNombre: ${item.name}\nTamaño: ${item.size} KB\nÚltima modificación: ${item.modified}`);
        }
      });

      grid.appendChild(el);
    });

    // Deseleccionar al hacer clic en el fondo de la cuadrícula
    grid.addEventListener('click', () => {
      this.win.querySelectorAll('.file-item').forEach(itemEl => itemEl.classList.remove('active'));
      this.selectedItem = null;
    });
  }

  renderSidebarSubfolders(items) {
    const subfolderContainer = this.win.querySelector('#file-tree-subfolders');
    
    // Solo actualizamos las subcarpetas del nivel actual si cargamos la raíz para simplificar
    if (this.currentPath === '') {
      subfolderContainer.innerHTML = '';
      items.filter(i => i.isDirectory).forEach(folder => {
        const row = document.createElement('div');
        row.className = 'folder-tree-item';
        row.style.paddingLeft = '20px';
        row.innerHTML = `
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style="color:#ffb020; margin-right:6px;"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
          <span>${folder.name}</span>
        `;
        row.addEventListener('click', (e) => {
          this.win.querySelectorAll('.folder-tree-item').forEach(el => el.classList.remove('active'));
          row.classList.add('active');
          this.loadDirectory(folder.path);
        });
        subfolderContainer.appendChild(row);
      });
    }
  }

  // B. Crear Carpeta
  async createFolder(name) {
    try {
      const res = await fetch(`${window.location.origin}/api/files/create-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: this.currentPath,
          name: name
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        this.loadDirectory(this.currentPath);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (e) {
      console.error('Error creando carpeta:', e);
    }
  }

  // C. Crear Archivo
  async createFile(name, content) {
    try {
      const res = await fetch(`${window.location.origin}/api/files/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: this.currentPath,
          name: name,
          content: content
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        this.loadDirectory(this.currentPath);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (e) {
      console.error('Error creando archivo:', e);
    }
  }

  // D. Eliminar Elemento
  async deleteItem(itemPath) {
    try {
      const res = await fetch(`${window.location.origin}/api/files/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: itemPath
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        this.loadDirectory(this.currentPath);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (e) {
      console.error('Error eliminando elemento:', e);
    }
  }
}

// Exportar globalmente
window.FileStationApp = new FileStation();
