/* =====================================================================
   APP: CENTRO DE PAQUETES (PACKAGE CENTER - DOCKER APP STORE)
   ===================================================================== */

class PackageCenter {
  constructor() {
    this.activeTab = 'all'; // 'all' o 'installed'
    this.containers = []; // Contenedores instalados reales o simulados devueltos por el backend
    this.win = null;
    
    // Lista maestra de paquetes de servidor disponibles
    this.availablePackages = {
      jellyfin: {
        name: 'Jellyfin',
        desc: 'Servidor multimedia de software libre para organizar y transmitir tus videos y música.',
        iconClass: 'pkg-jellyfin',
        port: 8096,
        iconSvg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`
      },
      qbittorrent: {
        name: 'qBittorrent',
        desc: 'Cliente BitTorrent potente, rápido y de código abierto con una excelente interfaz web.',
        iconClass: 'pkg-qbittorrent',
        port: 8080,
        iconSvg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M4 20h16v2H4zm12-18L8 10h5v6h6l-8-8h-5z"/></svg>`
      },
      nextcloud: {
        name: 'Nextcloud',
        desc: 'Tu propia nube privada para almacenar documentos, sincronizar calendarios y compartir archivos.',
        iconClass: 'pkg-nextcloud',
        port: 8001,
        iconSvg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>`
      },
      portainer: {
        name: 'Portainer CE',
        desc: 'Interfaz de usuario gráfica ligera para gestionar fácilmente tus contenedores Docker locales.',
        iconClass: 'pkg-portainer',
        port: 9000,
        iconSvg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M4 4h16v16H4zm2 2v12h12V6z"/></svg>`
      },
      vscode: {
        name: 'VS Code Server',
        desc: 'Desarrolla en tu propio servidor NAS a través de una versión completa de VS Code en tu navegador.',
        iconClass: 'pkg-vscode',
        port: 8443,
        iconSvg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M23.92 6.14a.5.5 0 0 0-.18-.35L19.2.56a.5.5 0 0 0-.74.07l-3.3 4.25-5.91-3a.5.5 0 0 0-.67.22L.15 17.5a.5.5 0 0 0 .14.58l4.47 3.5a.5.5 0 0 0 .7-.05l3.25-4 5.92 2.87a.5.5 0 0 0 .64-.26L23.8 6.72a.5.5 0 0 0 .12-.58z"/></svg>`
      },
      pihole: {
        name: 'Pi-hole',
        desc: 'Agujero negro de DNS para bloquear anuncios no deseados y rastreadores en toda tu red local.',
        iconClass: 'pkg-pihole',
        port: 8053,
        iconSvg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`
      }
    };
  }

  init(win) {
    this.win = win;
    this.activeTab = 'all';
    
    this.bindEvents();
    this.loadPackages();
  }

  bindEvents() {
    this.win.querySelectorAll('.package-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.win.querySelectorAll('.package-tab-btn').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        this.activeTab = btn.getAttribute('data-pkg-tab');
        
        // Actualizar título
        const titleEl = this.win.querySelector('#pkg-view-title');
        titleEl.textContent = this.activeTab === 'all' ? 'Todas las Aplicaciones' : 'Aplicaciones Instaladas';
        
        this.renderPackages();
      });
    });
  }

  // A. Obtener estado de contenedores desde backend
  async loadPackages() {
    try {
      const res = await fetch(`${window.location.origin}/api/docker/containers`);
      this.containers = await res.json();
      this.renderPackages();
    } catch (e) {
      console.error('Error al cargar paquetes docker:', e);
    }
  }

  renderPackages() {
    const grid = this.win.querySelector('#package-list-grid');
    grid.innerHTML = '';

    let appsToRender = Object.keys(this.availablePackages);

    // Filtrar si estamos en pestaña "Instalado"
    if (this.activeTab === 'installed') {
      appsToRender = appsToRender.filter(key => {
        return this.containers.some(c => c.icon === key);
      });
    }

    if (appsToRender.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; color: var(--syno-text-muted); margin-top: 50px; font-size:12px;">
          No se encontraron aplicaciones en esta categoría.
        </div>
      `;
      return;
    }

    appsToRender.forEach(key => {
      const pkg = this.availablePackages[key];
      // Buscar si el docker correspondiente está activo
      const container = this.containers.find(c => c.icon === key);
      
      const card = document.createElement('div');
      card.className = 'package-card';
      card.id = `pkg-card-${key}`;
      
      let actionButtonsHtml = '';
      let statusLabel = '';

      if (container) {
        // La app está instalada
        const isRunning = container.state === 'running';
        statusLabel = isRunning 
          ? `<span style="font-size:10px; color:var(--syno-green); font-weight:600; margin-bottom:10px; display:block;">Ejecutándose</span>`
          : `<span style="font-size:10px; color:var(--syno-text-muted); font-weight:600; margin-bottom:10px; display:block;">Detenido</span>`;

        actionButtonsHtml = `
          <div class="pkg-installed-actions">
            <button class="pkg-btn-action pkg-btn-open" data-pkg-key="${key}" ${!isRunning ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>Abrir</button>
            <button class="pkg-btn-action pkg-btn-stop" data-container-id="${container.id}" data-action="${isRunning ? 'stop' : 'start'}">
              ${isRunning ? 'Detener' : 'Iniciar'}
            </button>
          </div>
          <button class="pkg-btn-install" style="background:transparent; border:1px solid rgba(231,76,60,0.3); color:var(--syno-red); margin-top:10px; font-size:9px; padding:3px 6px;" data-container-id="${container.id}" data-action="remove">
            Desinstalar
          </button>
        `;
      } else {
        // App disponible para instalar
        statusLabel = `<span style="font-size:10px; color:var(--syno-blue); font-weight:600; margin-bottom:10px; display:block;">Disponible</span>`;
        actionButtonsHtml = `
          <button class="pkg-btn-install" data-install-key="${key}">Instalar</button>
        `;
      }

      card.innerHTML = `
        <div class="pkg-icon-wrapper ${pkg.iconClass}">
          ${pkg.iconSvg}
        </div>
        <h4 class="pkg-name">${pkg.name}</h4>
        <p class="pkg-desc">${pkg.desc}</p>
        ${statusLabel}
        ${actionButtonsHtml}
        
        <!-- Barra de progreso para instalación -->
        <div class="pkg-install-progress">
          <div class="pkg-progress-fill" id="progress-${key}"></div>
        </div>
      `;

      // Enlazar eventos de botones
      // 1. Instalar
      const installBtn = card.querySelector('[data-install-key]');
      if (installBtn) {
        installBtn.addEventListener('click', () => {
          this.triggerInstall(key, pkg);
        });
      }

      // 2. Iniciar / Detener
      const toggleBtn = card.querySelector('[data-action="stop"], [data-action="start"]');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          const action = toggleBtn.getAttribute('data-action');
          const id = toggleBtn.getAttribute('data-container-id');
          this.toggleContainer(id, action);
        });
      }

      // 3. Desinstalar
      const removeBtn = card.querySelector('[data-action="remove"]');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          const id = removeBtn.getAttribute('data-container-id');
          const confirmRemove = confirm(`¿Está seguro de que desea eliminar la aplicación y su contenedor?`);
          if (confirmRemove) {
            this.toggleContainer(id, 'remove');
          }
        });
      }

      // 4. Abrir Puerto de la App
      const openBtn = card.querySelector('.pkg-btn-open');
      if (openBtn) {
        openBtn.addEventListener('click', () => {
          const hostIp = window.location.hostname;
          window.open(`http://${hostIp}:${pkg.port}`, '_blank');
        });
      }

      grid.appendChild(card);
    });
  }

  // B. Simular barra de descarga progresiva antes de disparar el backend
  triggerInstall(key, pkg) {
    const card = this.win.querySelector(`#pkg-card-${key}`);
    const installBtn = card.querySelector('.pkg-btn-install');
    const progressBar = card.querySelector('.pkg-install-progress');
    const progressFill = card.querySelector(`#progress-${key}`);

    installBtn.style.display = 'none';
    progressBar.style.display = 'block';

    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      progressFill.style.width = `${progress}%`;

      if (progress >= 100) {
        clearInterval(interval);
        this.installPackage(key);
      }
    }, 100); // 2 segundos total
  }

  // C. Disparar API de instalación Docker real o simulada
  async installPackage(key) {
    try {
      const res = await fetch(`${window.location.origin}/api/docker/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageKey: key })
      });
      const data = await res.json();
      
      // Lanzar notificación al escritorio
      this.pushNotification('Instalación Completada', `La aplicación ${this.availablePackages[key].name} se instaló correctamente en el servidor.`);
      
      // Recargar
      this.loadPackages();
    } catch (e) {
      console.error('Error instalando paquete:', e);
      alert('Error de conexión con el backend.');
    }
  }

  // D. Control de encendido/apagado/borrado de contenedores
  async toggleContainer(id, action) {
    try {
      const res = await fetch(`${window.location.origin}/api/docker/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
      });
      
      if (res.ok) {
        this.loadPackages();
      } else {
        alert('Error ejecutando comando Docker.');
      }
    } catch (e) {
      console.error(e);
    }
  }

  // E. Inyectar notificación dinámica al sistema DSM
  pushNotification(title, message) {
    const container = document.querySelector('.sidebar-content');
    
    // Quitar placeholder de vacío si existe
    if (container.innerHTML.includes('No hay notificaciones')) {
      container.innerHTML = '';
    }

    const item = document.createElement('div');
    item.className = 'notification-item';
    item.innerHTML = `
      <div class="notif-icon success">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
      </div>
      <div class="notif-body">
        <p class="notif-title">${title}</p>
        <p class="notif-desc">${message}</p>
        <span class="notif-time">Ahora</span>
      </div>
    `;
    container.insertBefore(item, container.firstChild);
    
    // Incrementar e indexar badge
    const badge = document.getElementById('notif-badge');
    badge.style.display = 'flex';
    badge.textContent = parseInt(badge.textContent || 0) + 1;
  }
}

// Exportar globalmente
window.PackageCenterApp = new PackageCenter();
