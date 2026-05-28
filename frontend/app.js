/* =====================================================================
   SYNOLOGY DSM - NÚCLEO DEL ENTORNO DE ESCRITORIO (WINDOW MANAGER)
   ===================================================================== */

const API_BASE = window.location.origin;

class DesktopManager {
  constructor() {
    this.windows = {};
    this.highestZIndex = 100;
    this.activeWindow = null;
    this.widgetsVisible = true;
    this.promptedDevices = new Set();
    
    this.init();
  }

  init() {
    this.initClock();
    this.initEvents();
    this.startStatsPolling();
    this.startUSBDetectionPolling();
    this.fetchStaticSystemInfo();
  }

  // 1. Reloj del Sistema
  initClock() {
    const timeEl = document.getElementById('clock-time');
    const dateEl = document.getElementById('clock-date');
    
    const updateTime = () => {
      const now = new Date();
      
      // Formato Hora: HH:MM
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      timeEl.textContent = `${hours}:${minutes}`;
      
      // Formato Fecha: DD MMM YYYY (Español)
      const options = { day: 'numeric', month: 'short', year: 'numeric' };
      dateEl.textContent = now.toLocaleDateString('es-ES', options);
    };

    updateTime();
    setInterval(updateTime, 1000);
  }

  // 2. Vinculación de Eventos Generales
  initEvents() {
    // Botón de Inicio / Lanzador de Apps
    const btnStart = document.getElementById('btn-start');
    const appLauncher = document.getElementById('app-launcher-overlay');
    
    btnStart.addEventListener('click', (e) => {
      e.stopPropagation();
      appLauncher.classList.toggle('hidden');
      btnStart.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!appLauncher.contains(e.target) && e.target !== btnStart && !btnStart.contains(e.target)) {
        appLauncher.classList.add('hidden');
        btnStart.classList.remove('active');
      }
    });

    // Búsqueda en el Lanzador
    const searchInput = document.getElementById('launcher-search-input');
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const items = document.querySelectorAll('.launcher-item');
      items.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(query)) {
          item.style.display = 'flex';
        } else {
          item.style.display = 'none';
        }
      });
    });

    // Abrir aplicaciones desde Lanzador y Accesos Directos
    document.querySelectorAll('[data-app]').forEach(el => {
      el.addEventListener('click', (e) => {
        const appKey = el.getAttribute('data-app');
        this.openApp(appKey);
        appLauncher.classList.add('hidden');
        btnStart.classList.remove('active');
      });
    });

    // Mostrar/Ocultar Widgets
    const btnWidgets = document.getElementById('btn-widgets-toggle');
    const widgetsArea = document.getElementById('desktop-widgets');
    const desktopIcons = document.getElementById('desktop-icons');

    btnWidgets.addEventListener('click', () => {
      this.widgetsVisible = !this.widgetsVisible;
      if (this.widgetsVisible) {
        widgetsArea.style.transform = 'translateX(0)';
        desktopIcons.style.width = 'calc(100% - 320px)';
        btnWidgets.classList.add('active');
      } else {
        widgetsArea.style.transform = 'translateX(320px)';
        desktopIcons.style.width = '100%';
        btnWidgets.classList.remove('active');
      }
    });

    // Barra de Notificaciones
    const btnNotif = document.getElementById('btn-notifications');
    const notifSidebar = document.getElementById('notification-sidebar');
    
    btnNotif.addEventListener('click', (e) => {
      e.stopPropagation();
      notifSidebar.classList.toggle('hidden-sidebar');
    });

    document.addEventListener('click', (e) => {
      if (!notifSidebar.contains(e.target) && !btnNotif.contains(e.target)) {
        notifSidebar.classList.add('hidden-sidebar');
      }
    });

    document.getElementById('clear-notifications').addEventListener('click', () => {
      document.querySelector('.sidebar-content').innerHTML = `
        <div style="text-align: center; color: var(--syno-text-muted); margin-top: 40px; font-size: 12px;">
          No hay notificaciones nuevas.
        </div>
      `;
      document.getElementById('notif-badge').style.display = 'none';
    });
  }

  // 3. Crear y Abrir Aplicaciones en Ventanas (Window Manager)
  openApp(appKey) {
    if (this.windows[appKey]) {
      this.focusWindow(appKey);
      if (this.windows[appKey].classList.contains('minimized')) {
        this.windows[appKey].classList.remove('minimized');
        this.windows[appKey].style.display = 'flex';
      }
      return;
    }

    const appConfig = this.getAppConfig(appKey);
    if (!appConfig) return;

    // Crear elemento de ventana
    const win = document.createElement('div');
    win.id = `win-${appKey}`;
    win.className = 'window';
    win.style.width = `${appConfig.width}px`;
    win.style.height = `${appConfig.height}px`;
    
    // Centrar en pantalla por defecto
    const left = (window.innerWidth - appConfig.width) / 2 + (Object.keys(this.windows).length * 20);
    const top = (window.innerHeight - appConfig.height) / 2 + (Object.keys(this.windows).length * 20);
    win.style.left = `${Math.max(20, left)}px`;
    win.style.top = `${Math.max(60, top)}px`;
    
    win.innerHTML = `
      <div class="window-header">
        <div class="window-title-container">
          ${appConfig.iconSvg}
          <span class="window-title">${appConfig.title}</span>
        </div>
        <div class="window-controls">
          <button class="win-btn win-btn-minimize" title="Minimizar">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <button class="win-btn win-btn-maximize" title="Maximizar/Restaurar">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
            </svg>
          </button>
          <button class="win-btn win-btn-close" title="Cerrar">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="window-content">
        <!-- Renderizado de la App -->
        ${appConfig.contentHtml}
      </div>
    `;

    document.getElementById('windows-container').appendChild(win);
    this.windows[appKey] = win;
    
    // Configurar comportamiento drag-and-drop
    this.makeDraggable(win);
    
    // Registrar controladores de controles de ventana
    win.querySelector('.win-btn-minimize').addEventListener('click', (e) => {
      e.stopPropagation();
      this.minimizeWindow(appKey);
    });
    win.querySelector('.win-btn-maximize').addEventListener('click', (e) => {
      e.stopPropagation();
      this.maximizeWindow(appKey);
    });
    win.querySelector('.win-btn-close').addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeWindow(appKey);
    });

    win.addEventListener('mousedown', () => {
      this.focusWindow(appKey);
    });

    // Inicializar lógica de aplicación específica
    this.initAppLogic(appKey, win);

    // Crear pestaña en barra de tareas
    this.createTaskbarTab(appKey, appConfig);
    
    this.focusWindow(appKey);
  }

  makeDraggable(win) {
    const header = win.querySelector('.window-header');
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    header.addEventListener('mousedown', (e) => {
      if (win.classList.contains('maximized')) return; // No mover si está maximizada
      
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = win.offsetLeft;
      initialTop = win.offsetTop;
      
      this.focusWindow(win.id.replace('win-', ''));
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      // Límites de pantalla seguros
      let nextLeft = initialLeft + dx;
      let nextTop = initialTop + dy;
      
      if (nextTop < 48) nextTop = 48; // No traspasar barra de tareas
      
      win.style.left = `${nextLeft}px`;
      win.style.top = `${nextTop}px`;
    };

    const onMouseUp = () => {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }

  focusWindow(appKey) {
    const win = this.windows[appKey];
    if (!win) return;
    
    // Quitar active a ventana previa
    if (this.activeWindow) {
      this.activeWindow.classList.remove('active-window');
    }
    
    this.highestZIndex++;
    win.style.zIndex = this.highestZIndex;
    win.classList.add('active-window');
    this.activeWindow = win;

    // Actualizar tabs de barra de tareas
    document.querySelectorAll('.taskbar-app-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    const activeTab = document.getElementById(`tab-${appKey}`);
    if (activeTab) activeTab.classList.add('active');
  }

  minimizeWindow(appKey) {
    const win = this.windows[appKey];
    if (!win) return;
    
    win.classList.add('minimized');
    win.style.display = 'none';
    
    // Desenfocar
    if (this.activeWindow === win) {
      win.classList.remove('active-window');
      this.activeWindow = null;
      
      // Enfocar otra ventana activa si hay
      const visibleWins = Object.keys(this.windows).filter(k => k !== appKey && !this.windows[k].classList.contains('minimized'));
      if (visibleWins.length > 0) {
        this.focusWindow(visibleWins[visibleWins.length - 1]);
      } else {
        document.querySelectorAll('.taskbar-app-tab').forEach(t => t.classList.remove('active'));
      }
    }
  }

  maximizeWindow(appKey) {
    const win = this.windows[appKey];
    if (!win) return;
    
    if (win.classList.contains('maximized')) {
      // Restaurar tamaño original
      win.classList.remove('maximized');
      win.style.width = win.dataset.prevWidth + 'px';
      win.style.height = win.dataset.prevHeight + 'px';
      win.style.left = win.dataset.prevLeft + 'px';
      win.style.top = win.dataset.prevTop + 'px';
    } else {
      // Almacenar previas
      win.dataset.prevWidth = win.offsetWidth;
      win.dataset.prevHeight = win.offsetHeight;
      win.dataset.prevLeft = win.offsetLeft;
      win.dataset.prevTop = win.offsetTop;
      
      // Maximizar a pantalla
      win.classList.add('maximized');
      win.style.width = '100%';
      win.style.height = 'calc(100% - 48px)';
      win.style.left = '0';
      win.style.top = '48px';
    }
  }

  closeWindow(appKey) {
    const win = this.windows[appKey];
    if (!win) return;

    // Destruir procesos asociados en la ventana si existen
    if (appKey === 'resource-monitor' && window.ResourceMonitorApp) {
      window.ResourceMonitorApp.destroy();
    }

    win.remove();
    delete this.windows[appKey];
    
    // Eliminar pestaña de barra de tareas
    const tab = document.getElementById(`tab-${appKey}`);
    if (tab) tab.remove();

    if (this.activeWindow === win) {
      this.activeWindow = null;
      const keys = Object.keys(this.windows);
      if (keys.length > 0) {
        this.focusWindow(keys[keys.length - 1]);
      }
    }
  }

  createTaskbarTab(appKey, config) {
    const tab = document.createElement('div');
    tab.id = `tab-${appKey}`;
    tab.className = 'taskbar-app-tab';
    tab.innerHTML = `
      ${config.iconSvg}
      <span>${config.title}</span>
    `;
    
    tab.addEventListener('click', () => {
      const win = this.windows[appKey];
      if (win.classList.contains('minimized') || this.activeWindow !== win) {
        win.classList.remove('minimized');
        win.style.display = 'flex';
        this.focusWindow(appKey);
      } else {
        this.minimizeWindow(appKey);
      }
    });

    document.getElementById('open-apps-container').appendChild(tab);
  }

  // 4. Configuraciones y HTML Estructural de Apps
  getAppConfig(appKey) {
    const configs = {
      'resource-monitor': {
        title: 'Monitor de Recursos',
        width: 720,
        height: 480,
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>`,
        contentHtml: `
          <div class="res-mon-layout">
            <nav class="res-mon-tabs">
              <button class="res-tab-btn active" data-res="cpu">CPU</button>
              <button class="res-tab-btn" data-res="ram">Memoria RAM</button>
            </nav>
            <div class="res-mon-body">
              <div class="chart-panel-header">
                <h3 class="chart-title" id="res-mon-title">Rendimiento CPU</h3>
              </div>
              <div class="chart-stats-grid" id="res-mon-stats">
                <!-- Se inyecta dinámicamente -->
              </div>
              <div class="canvas-container">
                <canvas id="res-chart-canvas"></canvas>
              </div>
            </div>
          </div>
        `
      },
      'file-station': {
        title: 'File Station',
        width: 820,
        height: 520,
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 10H6v-2h8v2zm4-4H6v-2h12v2z"/></svg>`,
        contentHtml: `
          <div class="file-station-layout">
            <div class="file-toolbar">
              <div class="file-actions-left">
                <button class="file-btn" id="file-btn-newfolder">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 5v14M5 12h14"/>
                  </svg> Nueva Carpeta
                </button>
                <button class="file-btn" id="file-btn-upload">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                  </svg> Crear Archivo
                </button>
                <button class="file-btn" id="file-btn-delete" style="color: var(--syno-red);">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg> Eliminar
                </button>
              </div>
              <div class="file-actions-right">
                <div class="file-path-bar" id="file-path-display">/</div>
              </div>
            </div>
            <div class="file-workspace">
              <aside class="file-sidebar">
                <div class="folder-tree-item active" data-path="">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="color:#ffb020;"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                  <span>shares (Raíz)</span>
                </div>
                <div id="file-tree-subfolders"></div>
              </aside>
              <main class="file-main-view" id="file-view-grid">
                <!-- Archivos inyectados dinámicamente -->
              </main>
            </div>
          </div>
        `
      },
      'package-center': {
        title: 'Centro de Paquetes',
        width: 800,
        height: 500,
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
        contentHtml: `
          <div class="package-center-layout">
            <aside class="package-sidebar">
              <button class="package-tab-btn active" data-pkg-tab="all">Todas las Apps</button>
              <button class="package-tab-btn" data-pkg-tab="installed">Instalado</button>
            </aside>
            <main class="package-main-view">
              <div class="package-title-section">
                <h3 id="pkg-view-title">Todas las Aplicaciones</h3>
              </div>
              <div class="package-grid" id="package-list-grid">
                <!-- Tarjetas inyectadas dinámicamente -->
              </div>
            </main>
          </div>
        `
      },
      'control-panel': {
        title: 'Panel de Control',
        width: 780,
        height: 480,
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`,
        contentHtml: `
          <div class="ctrl-panel-layout">
            <aside class="ctrl-sidebar">
              <button class="ctrl-side-btn active" data-ctrl-section="info">
                <span>Información General</span>
              </button>
              <button class="ctrl-side-btn" data-ctrl-section="network">
                <span>Red (IP / DHCP)</span>
              </button>
              <button class="ctrl-side-btn" data-ctrl-section="samba">
                <span>Servicios de Red (Samba)</span>
              </button>
              <button class="ctrl-side-btn" data-ctrl-section="system">
                <span>Ajustes del Sistema</span>
              </button>
            </aside>
            <main class="ctrl-main-view">
              
              <!-- Seccion A: Info General -->
              <div class="ctrl-section" id="ctrl-sec-info">
                <h3 class="ctrl-section-title">Información del Servidor Linux</h3>
                <div class="ctrl-grid">
                  <div class="ctrl-card">
                    <h4 style="margin-bottom:12px; font-size:13px; font-family:var(--font-display);">Sistema y Hardware</h4>
                    <div class="ctrl-row"><span class="ctrl-row-lbl">Nombre del Servidor</span><span class="ctrl-row-val" id="ctrl-val-hostname">Cargando...</span></div>
                    <div class="ctrl-row"><span class="ctrl-row-lbl">Modelo</span><span class="ctrl-row-val" id="ctrl-val-model">Cargando...</span></div>
                    <div class="ctrl-row"><span class="ctrl-row-lbl">CPU Instalada</span><span class="ctrl-row-val" id="ctrl-val-cpu">Cargando...</span></div>
                    <div class="ctrl-row"><span class="ctrl-row-lbl">Núcleos CPU</span><span class="ctrl-row-val" id="ctrl-val-cores">Cargando...</span></div>
                  </div>
                  <div class="ctrl-card">
                    <h4 style="margin-bottom:12px; font-size:13px; font-family:var(--font-display);">Sistema Operativo</h4>
                    <div class="ctrl-row"><span class="ctrl-row-lbl">Distribución OS</span><span class="ctrl-row-val" id="ctrl-val-os">Cargando...</span></div>
                    <div class="ctrl-row"><span class="ctrl-row-lbl">Versión de Kernel</span><span class="ctrl-row-val" id="ctrl-val-kernel">Cargando...</span></div>
                    <div class="ctrl-row"><span class="ctrl-row-lbl">Fabricante</span><span class="ctrl-row-val" id="ctrl-val-manufacturer">Cargando...</span></div>
                  </div>
                </div>
              </div>

              <!-- Seccion B: Red -->
              <div class="ctrl-section hidden" id="ctrl-sec-network">
                <h3 class="ctrl-section-title">Configuración de Red</h3>
                <div class="ctrl-card" style="max-width: 500px;">
                  <div class="ctrl-input-group">
                    <label>Modo de Configuración de IP</label>
                    <select id="ctrl-net-mode" style="background:rgba(0,0,0,0.3); border:var(--border-glass); color:white; padding:8px; border-radius:6px; width:100%; outline:none; margin-top:6px;">
                      <option value="dhcp">DHCP (IP Automática)</option>
                      <option value="static">Dirección IP Estática (Manual)</option>
                    </select>
                  </div>
                  <div id="ctrl-net-static-fields" class="hidden" style="margin-top:14px;">
                    <div class="ctrl-input-group" style="margin-top:10px;">
                      <label style="font-size:11px; color:var(--syno-text-muted);">Dirección IP del NAS</label>
                      <input type="text" id="ctrl-net-ip" placeholder="192.168.1.150" style="background:rgba(0,0,0,0.2); border:var(--border-glass); color:white; padding:8px; border-radius:6px; width:100%; outline:none; margin-top:4px;">
                    </div>
                    <div class="ctrl-input-group" style="margin-top:10px;">
                      <label style="font-size:11px; color:var(--syno-text-muted);">Máscara de Subred</label>
                      <input type="text" id="ctrl-net-mask" placeholder="255.255.255.0" style="background:rgba(0,0,0,0.2); border:var(--border-glass); color:white; padding:8px; border-radius:6px; width:100%; outline:none; margin-top:4px;">
                    </div>
                    <div class="ctrl-input-group" style="margin-top:10px;">
                      <label style="font-size:11px; color:var(--syno-text-muted);">Puerta de Enlace (Gateway)</label>
                      <input type="text" id="ctrl-net-gateway" placeholder="192.168.1.1" style="background:rgba(0,0,0,0.2); border:var(--border-glass); color:white; padding:8px; border-radius:6px; width:100%; outline:none; margin-top:4px;">
                    </div>
                    <div class="ctrl-input-group" style="margin-top:10px;">
                      <label style="font-size:11px; color:var(--syno-text-muted);">Servidor DNS</label>
                      <input type="text" id="ctrl-net-dns" placeholder="8.8.8.8" style="background:rgba(0,0,0,0.2); border:var(--border-glass); color:white; padding:8px; border-radius:6px; width:100%; outline:none; margin-top:4px;">
                    </div>
                  </div>
                  <button class="file-btn" id="ctrl-net-apply-btn" style="background:var(--syno-blue); border-color:var(--syno-blue); color:white; margin-top:20px; width:100%; padding:8px; justify-content:center;">Aplicar Cambios de Red</button>
                </div>
              </div>

              <!-- Seccion C: Samba -->
              <div class="ctrl-section hidden" id="ctrl-sec-samba">
                <h3 class="ctrl-section-title">Servicio de Archivos en Red (Samba / SMB)</h3>
                <div class="ctrl-card" style="max-width: 500px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                    <div>
                      <h4 style="font-size:13px; font-family:var(--font-display);">Servicio Samba (Windows / Mac / Linux)</h4>
                      <p style="font-size:10px; color:var(--syno-text-muted); margin-top:2px;">Permite compartir archivos por la red local.</p>
                    </div>
                    <input type="checkbox" id="ctrl-samba-toggle" style="width:20px; height:20px; cursor:pointer;">
                  </div>
                  <div style="background:rgba(0,0,0,0.2); border:var(--border-glass); border-radius:8px; padding:12px; font-size:11px; line-height:1.5;">
                    <p style="font-weight:700; color:var(--syno-blue); margin-bottom:6px;">🔌 Rutas de Conexión Local:</p>
                    <p style="margin-bottom:4px;">💻 Windows: <span style="font-family:monospace; background:rgba(0,0,0,0.3); padding:2px 4px; border-radius:3px;">\\\\<span class="smb-host-placeholder">IP_NAS</span>\\shares</span></p>
                    <p style="margin-bottom:4px;">🍏 macOS: <span style="font-family:monospace; background:rgba(0,0,0,0.3); padding:2px 4px; border-radius:3px;">smb://<span class="smb-host-placeholder">IP_NAS</span>/shares</span></p>
                    <p>🐧 Linux: <span style="font-family:monospace; background:rgba(0,0,0,0.3); padding:2px 4px; border-radius:3px;">mount -t cifs //<span class="smb-host-placeholder">IP_NAS</span>/shares /mnt</span></p>
                  </div>
                  <button class="file-btn" id="ctrl-samba-apply-btn" style="background:var(--syno-blue); border-color:var(--syno-blue); color:white; margin-top:20px; width:100%; padding:8px; justify-content:center;">Guardar Estado de Samba</button>
                </div>
              </div>

              <!-- Seccion D: System Config -->
              <div class="ctrl-section hidden" id="ctrl-sec-system">
                <h3 class="ctrl-section-title">Configuración del Sistema</h3>
                <div class="ctrl-card" style="max-width: 500px;">
                  <div class="ctrl-input-group">
                    <label>Puerto del Servidor Web</label>
                    <input type="number" id="ctrl-sys-port" placeholder="5000" style="background:rgba(0,0,0,0.2); border:var(--border-glass); color:white; padding:8px; border-radius:6px; width:100%; outline:none; margin-top:6px;">
                    <p style="font-size:9px; color:var(--syno-text-muted); margin-top:4px;">Nota: Cambiar el puerto reiniciará automáticamente el panel.</p>
                  </div>
                  <div class="ctrl-input-group" style="margin-top:16px;">
                    <label>Zona Horaria (Timezone)</label>
                    <select id="ctrl-sys-tz" style="background:rgba(0,0,0,0.3); border:var(--border-glass); color:white; padding:8px; border-radius:6px; width:100%; outline:none; margin-top:6px;">
                      <option value="Europe/Madrid">Europe/Madrid (España)</option>
                      <option value="America/Santiago">America/Santiago (Chile)</option>
                      <option value="America/New_York">America/New_York (EE.UU. Este)</option>
                      <option value="America/Argentina/Buenos_Aires">America/Argentina/Buenos_Aires</option>
                      <option value="America/Mexico_City">America/Mexico_City (México)</option>
                      <option value="UTC">UTC / Greenwich</option>
                    </select>
                  </div>
                  <button class="file-btn" id="ctrl-sys-apply-btn" style="background:var(--syno-blue); border-color:var(--syno-blue); color:white; margin-top:24px; width:100%; padding:8px; justify-content:center;">Guardar Configuración General</button>
                </div>
              </div>

            </main>
          </div>
        `
      },
      'download-station': {
        title: 'Download Station',
        width: 820,
        height: 480,
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>`,
        contentHtml: `
          <div class="download-layout">
            <aside class="dl-sidebar">
              <button class="dl-tab-btn active" data-dl-tab="all">Todas <span class="dl-count-badge" id="dl-count-all">0</span></button>
              <button class="dl-tab-btn" data-dl-tab="downloading">Descargando <span class="dl-count-badge" id="dl-count-downloading">0</span></button>
              <button class="dl-tab-btn" data-dl-tab="completed">Completadas <span class="dl-count-badge" id="dl-count-completed">0</span></button>
            </aside>
            <main class="dl-main-view">
              <div class="dl-toolbar">
                <button class="file-btn" id="dl-btn-add" style="background:var(--syno-blue); border-color:var(--syno-blue); color:white;">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Agregar Tarea
                </button>
                <button class="file-btn" id="dl-btn-toggle">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> Pausar/Iniciar
                </button>
                <button class="file-btn" id="dl-btn-remove" style="color:var(--syno-red);">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Eliminar
                </button>
              </div>
              <div class="dl-list" id="dl-tasks-container">
                <!-- Tareas de descarga inyectadas dinámicamente -->
              </div>
            </main>
          </div>
        `
      }
    };

    return configs[appKey];
  }

  // 5. Enlazar la lógica JS a cada aplicación cuando se renderiza en el DOM
  initAppLogic(appKey, win) {
    if (appKey === 'resource-monitor') {
      if (window.ResourceMonitorApp) {
        window.ResourceMonitorApp.init(win);
      }
    } else if (appKey === 'file-station') {
      if (window.FileStationApp) {
        window.FileStationApp.init(win);
      }
    } else if (appKey === 'package-center') {
      if (window.PackageCenterApp) {
        window.PackageCenterApp.init(win);
      }
    } else if (appKey === 'download-station') {
      if (window.DownloadStationApp) {
        window.DownloadStationApp.init(win);
      }
    } else if (appKey === 'control-panel') {
      this.populateControlPanel(win);
    }
  }

  // 6. Cargar datos estáticos del Servidor Ubuntu
  async fetchStaticSystemInfo() {
    try {
      const res = await fetch(`${API_BASE}/api/system/static`);
      const data = await res.json();
      this.staticSystemInfo = data;
    } catch (e) {
      console.error('Error al precargar info estática:', e);
    }
  }

  populateControlPanel(win) {
    if (!this.staticSystemInfo || !win) return;
    
    // 1. Información General
    win.querySelector('#ctrl-val-hostname').textContent = this.staticSystemInfo.hostname;
    win.querySelector('#ctrl-val-model').textContent = this.staticSystemInfo.model;
    win.querySelector('#ctrl-val-cpu').textContent = this.staticSystemInfo.cpuModel;
    win.querySelector('#ctrl-val-cores').textContent = `${this.staticSystemInfo.cores} núcleos (${this.staticSystemInfo.cpuSpeed})`;
    win.querySelector('#ctrl-val-os').textContent = this.staticSystemInfo.os;
    win.querySelector('#ctrl-val-kernel').textContent = this.staticSystemInfo.kernel;
    win.querySelector('#ctrl-val-manufacturer').textContent = this.staticSystemInfo.manufacturer;

    const config = this.staticSystemInfo.config || {};

    // 2. Red (IP / DHCP)
    const netConfig = config.network || { mode: 'dhcp' };
    const netModeSelect = win.querySelector('#ctrl-net-mode');
    const staticFields = win.querySelector('#ctrl-net-static-fields');
    
    netModeSelect.value = netConfig.mode;
    if (netConfig.mode === 'static') {
      staticFields.classList.remove('hidden');
    }
    
    win.querySelector('#ctrl-net-ip').value = netConfig.ip || '';
    win.querySelector('#ctrl-net-mask').value = netConfig.netmask || '';
    win.querySelector('#ctrl-net-gateway').value = netConfig.gateway || '';
    win.querySelector('#ctrl-net-dns').value = netConfig.dns || '';

    netModeSelect.addEventListener('change', (e) => {
      if (e.target.value === 'static') {
        staticFields.classList.remove('hidden');
      } else {
        staticFields.classList.add('hidden');
      }
    });

    // 3. Samba
    const sambaConfig = config.samba || { enabled: true };
    const sambaToggle = win.querySelector('#ctrl-samba-toggle');
    sambaToggle.checked = sambaConfig.enabled;

    const hostIp = window.location.hostname;
    win.querySelectorAll('.smb-host-placeholder').forEach(el => {
      el.textContent = hostIp;
    });

    // 4. Configuración General (Timezone / Puerto)
    win.querySelector('#ctrl-sys-port').value = config.port || 5000;
    win.querySelector('#ctrl-sys-tz').value = config.timezone || 'Europe/Madrid';

    // ==========================================
    // EVENTOS APLICAR
    // ==========================================

    // A. Guardar Red
    win.querySelector('#ctrl-net-apply-btn').addEventListener('click', async () => {
      const settings = {
        mode: netModeSelect.value,
        ip: win.querySelector('#ctrl-net-ip').value,
        netmask: win.querySelector('#ctrl-net-mask').value,
        gateway: win.querySelector('#ctrl-net-gateway').value,
        dns: win.querySelector('#ctrl-net-dns').value
      };

      try {
        const res = await fetch(`${API_BASE}/api/system/network`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
        });
        const data = await res.json();
        if (res.ok) {
          alert('✓ Configuración de red aplicada y guardada correctamente.');
          this.fetchStaticSystemInfo();
        } else {
          alert('Error: ' + data.error);
        }
      } catch (e) {
        alert('Error al conectar con el servidor.');
      }
    });

    // B. Guardar Samba
    win.querySelector('#ctrl-samba-apply-btn').addEventListener('click', async () => {
      const enabled = sambaToggle.checked;
      try {
        const res = await fetch(`${API_BASE}/api/system/samba`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled })
        });
        const data = await res.json();
        if (res.ok) {
          alert('✓ Estado del servicio de compartición Samba guardado con éxito.');
          this.fetchStaticSystemInfo();
        } else {
          alert('Error: ' + data.error);
        }
      } catch (e) {
        alert('Error al guardar Samba.');
      }
    });

    // C. Guardar Sistema (Puerto / TZ)
    win.querySelector('#ctrl-sys-apply-btn').addEventListener('click', async () => {
      const newPort = parseInt(win.querySelector('#ctrl-sys-port').value);
      const newTz = win.querySelector('#ctrl-sys-tz').value;
      const oldPort = config.port || 5000;
      const oldTz = config.timezone || 'Europe/Madrid';

      try {
        if (newTz !== oldTz) {
          await fetch(`${API_BASE}/api/system/timezone`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timezone: newTz })
          });
        }

        if (newPort !== oldPort) {
          const confirmPort = confirm(`⚠️ Cambiar el puerto a ${newPort} requiere reiniciar el servidor Express del NAS. Se perderá la conexión web por unos segundos y tendrás que navegar a http://${hostIp}:${newPort}. ¿Deseas continuar?`);
          if (!confirmPort) return;
          
          const res = await fetch(`${API_BASE}/api/system/port`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ port: newPort })
          });
          const data = await res.json();
          
          if (res.ok) {
            alert(`✓ Puerto cambiado a ${newPort}. El panel se reiniciará. Redireccionando en 3 segundos...`);
            setTimeout(() => {
              window.location.href = `http://${hostIp}:${newPort}`;
            }, 3000);
          } else {
            alert('Error al cambiar el puerto: ' + data.error);
          }
        } else {
          alert('✓ Configuración del sistema guardada con éxito.');
          this.fetchStaticSystemInfo();
        }
      } catch (e) {
        alert('Error al aplicar cambios.');
      }
    });

    // ==========================================
    // EVENTOS BARRA LATERAL (TABS SWITCH)
    // ==========================================
    win.querySelectorAll('.ctrl-side-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        win.querySelectorAll('.ctrl-side-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        win.querySelectorAll('.ctrl-section').forEach(sec => sec.classList.add('hidden'));
        const targetSecId = `ctrl-sec-${btn.getAttribute('data-ctrl-section')}`;
        win.querySelector(`#${targetSecId}`).classList.remove('hidden');
      });
    });
  }

  // 7. Polling de Métricas del Servidor Ubuntu (CPU/RAM/Red/Uptime/Storage)
  startStatsPolling() {
    const updateStats = async () => {
      try {
        // A. Obtener métricas generales en tiempo real
        const sysRes = await fetch(`${API_BASE}/api/system/stats`);
        const sysData = await sysRes.json();
        
        // B. Actualizar Widgets del Escritorio
        // Salud/Uptime
        const hours = Math.floor(sysData.uptime / 3600);
        const mins = Math.floor((sysData.uptime % 3600) / 60);
        document.getElementById('uptime-text').textContent = `Uptime: ${hours}h ${mins}m`;
        
        // CPU Widget
        document.getElementById('widget-cpu-bar').style.width = `${sysData.cpu.usage}%`;
        document.getElementById('widget-cpu-text').textContent = `${sysData.cpu.usage}%`;
        
        // RAM Widget
        document.getElementById('widget-ram-bar').style.width = `${sysData.ram.percent}%`;
        document.getElementById('widget-ram-text').textContent = `${sysData.ram.percent}%`;

        // Velocidades de Red en barra
        document.getElementById('speed-rx').textContent = `${sysData.network.rx} KB/s`;
        document.getElementById('speed-tx').textContent = `${sysData.network.tx} KB/s`;

        // Propagar estadísticas si la aplicación Monitor de Recursos está abierta
        if (this.windows['resource-monitor'] && window.ResourceMonitorApp) {
          window.ResourceMonitorApp.updateStats(sysData);
        }

        // C. Obtener métricas de almacenamiento (menos frecuente en el servidor real, aquí polled a la par)
        const storeRes = await fetch(`${API_BASE}/api/storage/stats`);
        const storeData = await storeRes.json();
        
        if (storeData.mounts && storeData.mounts.length > 0) {
          // Tomar el montaje de almacenamiento principal o raíz
          const mainMount = storeData.mounts.find(m => m.mount === '/srv/nas/shares') || storeData.mounts[0];
          document.getElementById('widget-vol-title').textContent = `Volumen (${mainMount.type}) en ${mainMount.mount}`;
          document.getElementById('widget-storage-bar').style.width = `${mainMount.usePercent}%`;
          document.getElementById('widget-storage-text').textContent = `Usado: ${mainMount.used} GB / ${mainMount.size} GB (${mainMount.usePercent}%)`;
        }
        
      } catch (error) {
        console.error('Error al actualizar métricas en tiempo real:', error);
      }
    };

    updateStats();
    // Ejecutar cada 2 segundos
    setInterval(updateStats, 2000);
  }

  // 8. Polling de detección de Dispositivos USB
  startUSBDetectionPolling() {
    const checkUSB = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/storage/usb/unmounted`);
        const devices = await res.json();
        
        devices.forEach(device => {
          if (!this.promptedDevices.has(device.dev)) {
            this.promptedDevices.add(device.dev);
            this.showUSBModal(device);
          }
        });
      } catch (e) {
        console.error('Error escaneando USB:', e);
      }
    };

    // Escanear cada 4 segundos
    setInterval(checkUSB, 4000);
    // Primer escaneo retrasado 4s para dar tiempo a cargar el escritorio
    setTimeout(checkUSB, 4000);
  }

  showUSBModal(device) {
    const overlay = document.createElement('div');
    overlay.className = 'usb-modal-overlay';
    overlay.innerHTML = `
      <div class="usb-modal-card">
        <div class="usb-modal-header">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" style="color:var(--syno-blue);">
            <path d="M15 7v4h1v2h-3V7h2m0-2h-4v2h2v4H9V7h2V5H7v2h2v4H5v2h2v4h2v-4h4v4h2v-4h2V5z"/>
          </svg>
          <h4>🔌 Dispositivo USB Detectado</h4>
        </div>
        <div class="usb-modal-body" id="usb-modal-body-content">
          <p>Se ha conectado una unidad de almacenamiento externa:</p>
          <p style="margin: 8px 0; font-weight: 700; font-family: var(--font-display); font-size: 14px;">
            ${device.name} (${device.size} GB)
          </p>
          <p style="font-size: 11px; color: var(--syno-text-muted);">
            Sistema de archivos actual: <span style="text-transform:uppercase; font-weight:700; color:var(--syno-blue);">${device.fsType}</span>
          </p>
        </div>
        <div class="usb-modal-actions" id="usb-modal-action-buttons">
          <button class="usb-btn usb-btn-mount" id="usb-mount-btn">Montar Unidad</button>
          <button class="usb-btn usb-btn-format" id="usb-format-btn">Formatear</button>
          <button class="usb-btn usb-btn-ignore" id="usb-ignore-btn">Ignorar</button>
        </div>
      </div>
    `;

    document.getElementById('desktop').appendChild(overlay);

    // 1. Botón Ignorar
    overlay.querySelector('#usb-ignore-btn').addEventListener('click', () => {
      overlay.remove();
    });

    // 2. Botón Montar
    overlay.querySelector('#usb-mount-btn').addEventListener('click', () => {
      const defaultFolder = device.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const folderName = prompt('Ingrese el nombre de la carpeta virtual donde se montará en File Station:', defaultFolder);
      if (folderName) {
        this.mountUSB(device, folderName, overlay);
      }
    });

    // 3. Botón Formatear
    overlay.querySelector('#usb-format-btn').addEventListener('click', () => {
      this.showFormatOptions(device, overlay);
    });
  }

  async mountUSB(device, folderName, modalOverlay) {
    try {
      const res = await fetch(`${API_BASE}/api/storage/usb/mount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dev: device.dev,
          folderName: folderName
        })
      });
      const data = await res.json();

      if (res.ok) {
        modalOverlay.remove();
        this.pushDesktopNotification('Dispositivo Montado', `La unidad ${device.name} se montó con éxito en /shares/${folderName}`);
        
        // Abrir File Station directamente para ver la carpeta montada
        this.openApp('file-station');
        // Si File Station ya estaba abierto, recargarlo
        setTimeout(() => {
          if (window.FileStationApp && window.FileStationApp.win) {
            window.FileStationApp.loadDirectory('');
          }
        }, 1000);
      } else {
        alert('Error al montar: ' + data.error);
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión.');
    }
  }

  showFormatOptions(device, modalOverlay) {
    const bodyContent = modalOverlay.querySelector('#usb-modal-body-content');
    const actionsArea = modalOverlay.querySelector('#usb-modal-action-buttons');

    bodyContent.innerHTML = `
      <p style="color: var(--syno-red); font-weight: 700; margin-bottom: 8px;">⚠️ ¡ADVERTENCIA! El formateo borrará todos los datos.</p>
      <p>Selecciona el nuevo sistema de archivos para <strong>${device.name}</strong>:</p>
      <select id="usb-format-fs-select" style="width: 100%; margin-top: 10px; background: rgba(0,0,0,0.3); border: var(--border-glass); color: white; padding: 8px; border-radius: 6px; outline:none;">
        <option value="ntfs">NTFS (Windows / Linux)</option>
        <option value="exfat">exFAT (Multiplataforma - Recomendado)</option>
        <option value="fat32">FAT32 (Legacy / Pendrives)</option>
        <option value="ext4">EXT4 (Nativo de Linux)</option>
      </select>
    `;

    actionsArea.innerHTML = `
      <button class="usb-btn usb-btn-mount" id="usb-format-confirm-btn" style="background: var(--syno-red);">Formatear Ahora</button>
      <button class="usb-btn usb-btn-ignore" id="usb-format-back-btn">Volver</button>
    `;

    // Botón volver
    modalOverlay.querySelector('#usb-format-back-btn').addEventListener('click', () => {
      modalOverlay.remove();
      this.promptedDevices.delete(device.dev); // Permitir volver a preguntar
      this.startUSBDetectionPolling(); // Recheck
    });

    // Confirmar Formateo
    modalOverlay.querySelector('#usb-format-confirm-btn').addEventListener('click', async () => {
      const fsType = modalOverlay.querySelector('#usb-format-fs-select').value;
      
      bodyContent.innerHTML = `
        <div style="text-align:center; padding: 20px 0;">
          <div class="usb-loading-spinner"></div>
          <p style="margin-top:12px; font-weight:500;">Formateando dispositivo a ${fsType.toUpperCase()}...</p>
          <p style="font-size:10px; color:var(--syno-text-muted); margin-top:4px;">Esto puede tardar unos segundos...</p>
        </div>
      `;
      actionsArea.style.display = 'none';

      try {
        const res = await fetch(`${API_BASE}/api/storage/usb/format`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dev: device.dev,
            fsType: fsType
          })
        });
        const data = await res.json();

        if (res.ok) {
          bodyContent.innerHTML = `
            <p style="color:var(--syno-green); font-weight:700; margin-bottom:8px;">✓ ¡Formateo Completado!</p>
            <p>La unidad ha sido formateada con éxito. ¿Deseas montarla ahora?</p>
          `;
          actionsArea.style.display = 'flex';
          actionsArea.innerHTML = `
            <button class="usb-btn usb-btn-mount" id="usb-format-mount-now">Montar Unidad</button>
            <button class="usb-btn usb-btn-ignore" id="usb-format-finish-close">Cerrar</button>
          `;

          // Botón cerrar final
          modalOverlay.querySelector('#usb-format-finish-close').addEventListener('click', () => {
            modalOverlay.remove();
          });

          // Montar ahora
          modalOverlay.querySelector('#usb-format-mount-now').addEventListener('click', () => {
            device.fsType = fsType; // Actualizar local
            const defaultFolder = device.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
            const folderName = prompt('Ingrese el nombre de la carpeta virtual para montarlo:', defaultFolder);
            if (folderName) {
              this.mountUSB(device, folderName, modalOverlay);
            }
          });
        } else {
          alert('Error durante el formateo: ' + data.error);
          modalOverlay.remove();
        }
      } catch (e) {
        console.error(e);
        alert('Error de conexión.');
        modalOverlay.remove();
      }
    });
  }

  pushDesktopNotification(title, message) {
    if (window.PackageCenterApp) {
      window.PackageCenterApp.pushNotification(title, message);
    }
  }
}

// Inicializar el escritorio DSM al cargar la página
window.addEventListener('DOMContentLoaded', () => {
  window.DSM_Desktop = new DesktopManager();
});
