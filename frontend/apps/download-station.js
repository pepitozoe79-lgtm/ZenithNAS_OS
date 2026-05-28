/* =====================================================================
   APP: DOWNLOAD STATION - GESTOR DE DESCARGAS Y BITTORRENT
   ==================================================================== */

class DownloadStation {
  constructor() {
    this.activeTab = 'all'; // 'all', 'downloading', 'completed'
    this.tasks = [];
    this.selectedTaskId = null;
    this.win = null;
    this.pollingInterval = null;
  }

  init(win) {
    this.win = win;
    this.activeTab = 'all';
    this.selectedTaskId = null;
    
    this.bindEvents();
    this.loadDownloads();
    
    // Polling de descargas activo cada 2 segundos
    this.startPolling();
  }

  bindEvents() {
    // 1. Agregar Tarea
    this.win.querySelector('#dl-btn-add').addEventListener('click', () => {
      const url = prompt('Ingrese un enlace HTTP/HTTPS o un Magnet Link / Torrent:');
      if (url) {
        this.addDownloadTask(url);
      }
    });

    // 2. Pausar/Iniciar
    this.win.querySelector('#dl-btn-toggle').addEventListener('click', () => {
      if (!this.selectedTaskId) {
        alert('Por favor, seleccione una tarea de descarga de la lista primero.');
        return;
      }
      this.toggleTask(this.selectedTaskId);
    });

    // 3. Eliminar Tarea
    this.win.querySelector('#dl-btn-remove').addEventListener('click', () => {
      if (!this.selectedTaskId) {
        alert('Por favor, seleccione una tarea de descarga de la lista primero.');
        return;
      }
      const confirmRemove = confirm('¿Está seguro de que desea eliminar esta tarea de descarga?');
      if (confirmRemove) {
        this.removeTask(this.selectedTaskId);
      }
    });

    // 4. Pestañas laterales de filtrado
    this.win.querySelectorAll('.dl-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.win.querySelectorAll('.dl-tab-btn').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        this.activeTab = btn.getAttribute('data-dl-tab');
        
        this.renderDownloads();
      });
    });
  }

  startPolling() {
    this.stopPolling();
    this.pollingInterval = setInterval(() => {
      // Solo hacer poll si la ventana sigue existiendo y visible
      const el = document.getElementById(`win-download-station`);
      if (!el || el.style.display === 'none') {
        this.stopPolling();
        return;
      }
      this.loadDownloads();
    }, 2000);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // A. Obtener lista del servidor
  async loadDownloads() {
    try {
      const res = await fetch(`${window.location.origin}/api/downloads/list`);
      this.tasks = await res.json();
      
      this.updateSidebarBadges();
      this.renderDownloads();
    } catch (e) {
      console.error('Error al cargar descargas:', e);
    }
  }

  // B. Renderizar descargas filtradas
  renderDownloads() {
    const listContainer = this.win.querySelector('#dl-tasks-container');
    listContainer.innerHTML = '';

    let filteredTasks = this.tasks;
    if (this.activeTab === 'downloading') {
      filteredTasks = this.tasks.filter(t => t.status === 'downloading');
    } else if (this.activeTab === 'completed') {
      filteredTasks = this.tasks.filter(t => t.status === 'completed');
    }

    if (filteredTasks.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; color: var(--syno-text-muted); margin-top: 60px; font-size: 12px;">
          No hay tareas en esta categoría.
        </div>
      `;
      return;
    }

    filteredTasks.forEach(task => {
      const row = document.createElement('div');
      row.className = `dl-row ${this.selectedTaskId === task.id ? 'active' : ''}`;
      row.setAttribute('data-task-id', task.id);
      
      // Icono segun el tipo de descarga
      const typeIconSvg = task.type === 'torrent'
        ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-4h2v4zm0-6h-2V7h2v3z"/></svg>`
        : `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>`;

      // Modificadores de estado del progress bar
      let fillClass = '';
      if (task.status === 'completed') fillClass = 'completed';
      else if (task.status === 'paused') fillClass = 'paused';
      else if (task.status === 'failed') fillClass = 'failed';

      // Status text amigable
      let statusText = 'Pausado';
      if (task.status === 'downloading') statusText = 'Descargando';
      else if (task.status === 'completed') statusText = 'Completado';
      else if (task.status === 'failed') statusText = 'Error';

      row.innerHTML = `
        <div class="dl-info-col">
          <div class="dl-row-title-container">
            <span class="dl-row-type-badge ${task.type}">${task.type}</span>
            <span class="dl-row-title" title="${task.name}">${task.name}</span>
          </div>
          
          <div class="dl-progress-container">
            <div class="dl-progress-bar-bg">
              <div class="dl-progress-bar-fill ${fillClass}" style="width: ${task.progress}%"></div>
            </div>
            <span class="dl-row-percent">${task.progress}%</span>
          </div>
          
          <div class="dl-meta-row">
            <div class="dl-meta-item">Tamaño: <span>${task.sizeDownloaded} MB / ${task.sizeTotal > 0 ? task.sizeTotal + ' MB' : 'Desconocido'}</span></div>
            ${task.status === 'downloading' ? `<div class="dl-meta-item">Velocidad: <span style="color:var(--syno-blue);">${task.speed} MB/s</span></div>` : ''}
          </div>
        </div>
        
        <div class="dl-status-col">
          <span class="dl-status-text ${task.status}">${statusText}</span>
          <span class="dl-eta-text">${task.eta}</span>
        </div>
      `;

      // Seleccionar fila
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        this.win.querySelectorAll('.dl-row').forEach(r => r.classList.remove('active'));
        row.classList.add('active');
        this.selectedTaskId = task.id;
      });

      listContainer.appendChild(row);
    });

    // Deseleccionar al hacer clic en el fondo del listado
    listContainer.addEventListener('click', (e) => {
      if (e.target === listContainer) {
        this.win.querySelectorAll('.dl-row').forEach(r => r.classList.remove('active'));
        this.selectedTaskId = null;
      }
    });
  }

  // C. Actualizar contadores del menú lateral
  updateSidebarBadges() {
    const allCount = this.tasks.length;
    const dlCount = this.tasks.filter(t => t.status === 'downloading').length;
    const compCount = this.tasks.filter(t => t.status === 'completed').length;
    
    this.win.querySelector('#dl-count-all').textContent = allCount;
    this.win.querySelector('#dl-count-downloading').textContent = dlCount;
    this.win.querySelector('#dl-count-completed').textContent = compCount;
  }

  // D. Enviar tarea de descarga al backend
  async addDownloadTask(url) {
    try {
      const res = await fetch(`${window.location.origin}/api/downloads/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url })
      });
      const data = await res.json();
      
      if (res.ok) {
        this.loadDownloads();
      } else {
        alert('Error al agregar tarea: ' + data.error);
      }
    } catch (e) {
      console.error(e);
    }
  }

  // E. Iniciar/pausar descarga
  async toggleTask(id) {
    try {
      const res = await fetch(`${window.location.origin}/api/downloads/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
      });
      if (res.ok) {
        this.loadDownloads();
      }
    } catch (e) {
      console.error(e);
    }
  }

  // F. Eliminar descarga
  async removeTask(id) {
    try {
      const res = await fetch(`${window.location.origin}/api/downloads/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
      });
      if (res.ok) {
        this.selectedTaskId = null;
        this.loadDownloads();
      }
    } catch (e) {
      console.error(e);
    }
  }
}

// Exportar globalmente
window.DownloadStationApp = new DownloadStation();
