/* =====================================================================
   APP: MONITOR DE RECURSOS - GRÁFICOS FLUIDOS CON CANVAS
   ===================================================================== */

class ResourceMonitor {
  constructor() {
    this.activeTab = 'cpu'; // 'cpu' o 'ram'
    this.historyLimit = 30; // Puntos en el gráfico
    this.cpuHistory = Array(30).fill(0);
    this.ramHistory = Array(30).fill(0);
    this.win = null;
    this.canvas = null;
    this.ctx = null;
    this.animationId = null;
    this.lastData = null;
  }

  init(win) {
    this.win = win;
    this.canvas = win.querySelector('#res-chart-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Adaptar tamaño de canvas
    this.resizeCanvas();
    
    // Registrar eventos en los botones de pestañas
    win.querySelectorAll('.res-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        win.querySelectorAll('.res-tab-btn').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        this.activeTab = btn.getAttribute('data-res');
        
        // Actualizar título e interfaz
        win.querySelector('#res-mon-title').textContent = this.activeTab === 'cpu' ? 'Rendimiento CPU' : 'Rendimiento Memoria RAM';
        this.renderStatsReadout();
        this.drawChart();
      });
    });

    // Escuchar el rediseño de ventana para reajustar canvas
    const resizeObserver = new ResizeObserver(() => {
      this.resizeCanvas();
      this.drawChart();
    });
    resizeObserver.observe(this.canvas.parentElement);
    this.resizeObserver = resizeObserver;

    // Primer dibujado
    this.drawChart();
  }

  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    this.canvas.width = parent.clientWidth;
    this.canvas.height = parent.clientHeight;
  }

  updateStats(sysData) {
    this.lastData = sysData;

    // Agregar valores al historial y desplazar
    this.cpuHistory.push(sysData.cpu.usage);
    if (this.cpuHistory.length > this.historyLimit) {
      this.cpuHistory.shift();
    }

    this.ramHistory.push(sysData.ram.percent);
    if (this.ramHistory.length > this.historyLimit) {
      this.ramHistory.shift();
    }

    // Dibujar y actualizar textos
    this.renderStatsReadout();
    this.drawChart();
  }

  renderStatsReadout() {
    if (!this.lastData || !this.win) return;
    const statsContainer = this.win.querySelector('#res-mon-stats');
    
    if (this.activeTab === 'cpu') {
      statsContainer.innerHTML = `
        <div class="chart-stat-box">
          <div class="chart-stat-val" style="color:var(--syno-green);">${this.lastData.cpu.usage}%</div>
          <div class="chart-stat-lbl">Uso Total CPU</div>
        </div>
        <div class="chart-stat-box">
          <div class="chart-stat-val">${this.lastData.cpu.temp}°C</div>
          <div class="chart-stat-lbl">Temperatura</div>
        </div>
        <div class="chart-stat-box">
          <div class="chart-stat-val">${this.lastData.cpu.cores.length}</div>
          <div class="chart-stat-lbl">Núcleos Totales</div>
        </div>
      `;
    } else {
      statsContainer.innerHTML = `
        <div class="chart-stat-box">
          <div class="chart-stat-val" style="color:var(--syno-blue);">${this.lastData.ram.percent}%</div>
          <div class="chart-stat-lbl">En Uso</div>
        </div>
        <div class="chart-stat-box">
          <div class="chart-stat-val">${this.lastData.ram.used} GB</div>
          <div class="chart-stat-lbl">RAM Utilizada</div>
        </div>
        <div class="chart-stat-box">
          <div class="chart-stat-val">${this.lastData.ram.total} GB</div>
          <div class="chart-stat-lbl">RAM Total Instalada</div>
        </div>
      `;
    }
  }

  drawChart() {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Limpiar Canvas
    ctx.clearRect(0, 0, width, height);

    // Configurar Estilos Generales
    const data = this.activeTab === 'cpu' ? this.cpuHistory : this.ramHistory;
    const themeColor = this.activeTab === 'cpu' ? '#10b981' : '#3b82f6';
    const fillGlow = this.activeTab === 'cpu' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)';

    // Dibujar Rejilla de Fondo
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    
    // Líneas horizontales (4 divisiones)
    for (let i = 1; i < 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Líneas verticales (10 divisiones)
    for (let i = 1; i < 10; i++) {
      const x = (width / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Dibujar Curva de Recursos
    if (data.length < 2) return;

    ctx.beginPath();
    const getX = (index) => (width / (this.historyLimit - 1)) * index;
    const getY = (val) => height - ((height - 20) * (val / 100)) - 10; // Margen de 10px arriba/abajo

    // Curva principal
    ctx.moveTo(getX(0), getY(data[0]));
    for (let i = 1; i < data.length; i++) {
      // Dibujamos curvas Bezier suaves
      const xc = (getX(i - 1) + getX(i)) / 2;
      const yc = (getY(data[i - 1]) + getY(data[i])) / 2;
      ctx.quadraticCurveTo(getX(i - 1), getY(data[i - 1]), xc, yc);
    }
    ctx.lineTo(getX(data.length - 1), getY(data[data.length - 1]));
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = themeColor;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0; // Desactivar shadow para el relleno

    // Relleno degradado debajo de la curva
    const fillPath = new Path2D();
    fillPath.moveTo(getX(0), height);
    fillPath.lineTo(getX(0), getY(data[0]));
    for (let i = 1; i < data.length; i++) {
      const xc = (getX(i - 1) + getX(i)) / 2;
      const yc = (getY(data[i - 1]) + getY(data[i])) / 2;
      fillPath.quadraticCurveTo(getX(i - 1), getY(data[i - 1]), xc, yc);
    }
    fillPath.lineTo(getX(data.length - 1), getY(data[data.length - 1]));
    fillPath.lineTo(getX(data.length - 1), height);
    fillPath.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, fillGlow);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fill(fillPath);
  }
}

// Exportar globalmente
window.ResourceMonitorApp = new ResourceMonitor();
