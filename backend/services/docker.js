const { exec } = require('child_process');

// Lista en memoria para cuando Docker real no está presente
let mockContainers = [
  {
    id: 'jellyfin-nas',
    name: 'Jellyfin',
    image: 'jellyfin/jellyfin:latest',
    state: 'running',
    status: 'Up 3 hours',
    ports: '8096:8096',
    icon: 'jellyfin'
  },
  {
    id: 'qbittorrent-nas',
    name: 'qBittorrent',
    image: 'linuxserver/qbittorrent:latest',
    state: 'exited',
    status: 'Exited (0) 2 days ago',
    ports: '8080:8080',
    icon: 'qbittorrent'
  }
];

// Metadatos de aplicaciones instalables (imágenes docker de origen)
const PACKAGES = {
  jellyfin: {
    name: 'Jellyfin',
    image: 'jellyfin/jellyfin:latest',
    ports: '8096:8096',
    volumes: '/srv/nas/shares/video:/data'
  },
  qbittorrent: {
    name: 'qBittorrent',
    image: 'linuxserver/qbittorrent:latest',
    ports: '8080:8080,8999:8999',
    volumes: '/srv/nas/shares/downloads:/downloads'
  },
  nextcloud: {
    name: 'Nextcloud',
    image: 'nextcloud:latest',
    ports: '8001:80',
    volumes: '/srv/nas/shares/public:/var/www/html'
  },
  portainer: {
    name: 'Portainer',
    image: 'portainer/portainer-ce:latest',
    ports: '9000:9000',
    volumes: '/var/run/docker.sock:/var/run/docker.sock'
  },
  vscode: {
    name: 'VS Code Server',
    image: 'codercom/code-server:latest',
    ports: '8443:8443',
    volumes: '/srv/nas/shares/public:/home/coder/project'
  },
  pihole: {
    name: 'Pi-hole',
    image: 'pihole/pihole:latest',
    ports: '8053:80,53:53/udp',
    volumes: '/srv/nas/shares/dns:/etc/pihole'
  }
};

/**
 * Verifica si Docker está instalado y en ejecución en el host Ubuntu.
 */
function isDockerInstalled() {
  return new Promise((resolve) => {
    exec('docker ps', (error) => {
      if (error) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

/**
 * Obtiene la lista de contenedores Docker (reales o simulados).
 */
async function getContainers() {
  const realDocker = await isDockerInstalled();

  if (!realDocker) {
    return mockContainers;
  }

  return new Promise((resolve) => {
    exec('docker ps -a --format "{{.ID}}||{{.Names}}||{{.Image}}||{{.State}}||{{.Status}}||{{.Ports}}"', (error, stdout) => {
      if (error) {
        return resolve(mockContainers);
      }

      const lines = stdout.trim().split('\n').filter(Boolean);
      const containers = lines.map(line => {
        const [id, name, image, state, status, ports] = line.split('||');
        // Traducir nombre de icono básico
        let icon = 'generic';
        const nameLower = name.toLowerCase();
        if (nameLower.includes('jellyfin')) icon = 'jellyfin';
        else if (nameLower.includes('qbittorrent')) icon = 'qbittorrent';
        else if (nameLower.includes('nextcloud')) icon = 'nextcloud';
        else if (nameLower.includes('portainer')) icon = 'portainer';
        else if (nameLower.includes('code-server') || nameLower.includes('vscode')) icon = 'vscode';
        else if (nameLower.includes('pihole')) icon = 'pihole';

        return {
          id,
          name: name.charAt(0).toUpperCase() + name.slice(1),
          image,
          state, // 'running', 'exited', 'paused'
          status,
          ports: ports || 'N/A',
          icon
        };
      });

      resolve(containers);
    });
  });
}

/**
 * Inicia un contenedor.
 */
async function startContainer(id) {
  const realDocker = await isDockerInstalled();

  if (!realDocker) {
    const container = mockContainers.find(c => c.id === id);
    if (container) {
      container.state = 'running';
      container.status = 'Up Just Now';
      return { success: true, message: `Contenedor ${container.name} iniciado (simulado).` };
    }
    return { success: false, message: 'Contenedor no encontrado.' };
  }

  return new Promise((resolve) => {
    exec(`docker start ${id}`, (error) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true, message: `Contenedor ${id} iniciado.` });
      }
    });
  });
}

/**
 * Detiene un contenedor.
 */
async function stopContainer(id) {
  const realDocker = await isDockerInstalled();

  if (!realDocker) {
    const container = mockContainers.find(c => c.id === id);
    if (container) {
      container.state = 'exited';
      container.status = 'Exited (0) Just Now';
      return { success: true, message: `Contenedor ${container.name} detenido (simulado).` };
    }
    return { success: false, message: 'Contenedor no encontrado.' };
  }

  return new Promise((resolve) => {
    exec(`docker stop ${id}`, (error) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true, message: `Contenedor ${id} detenido.` });
      }
    });
  });
}

/**
 * Elimina o desinstala un contenedor.
 */
async function removeContainer(id) {
  const realDocker = await isDockerInstalled();

  if (!realDocker) {
    const index = mockContainers.findIndex(c => c.id === id);
    if (index !== -1) {
      const removed = mockContainers.splice(index, 1);
      return { success: true, message: `Contenedor ${removed[0].name} desinstalado (simulado).` };
    }
    return { success: false, message: 'Contenedor no encontrado.' };
  }

  return new Promise((resolve) => {
    exec(`docker rm -f ${id}`, (error) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true, message: `Contenedor ${id} eliminado.` });
      }
    });
  });
}

/**
 * Instala un nuevo paquete/contenedor.
 */
async function installPackage(packageKey) {
  const pkg = PACKAGES[packageKey];
  if (!pkg) {
    return { success: false, message: 'Paquete de aplicación no soportado.' };
  }

  const realDocker = await isDockerInstalled();

  if (!realDocker) {
    // Verificar si ya existe
    const exists = mockContainers.some(c => c.name.toLowerCase() === pkg.name.toLowerCase());
    if (exists) {
      return { success: true, message: `La aplicación ${pkg.name} ya está instalada.` };
    }

    // Agregar simulado
    const newMock = {
      id: `${packageKey}-nas`,
      name: pkg.name,
      image: pkg.image,
      state: 'running',
      status: 'Up Just Now',
      ports: pkg.ports,
      icon: packageKey
    };
    mockContainers.push(newMock);
    return { success: true, message: `Aplicación ${pkg.name} instalada correctamente (simulado).` };
  }

  // Comando docker run real
  // Mapeamos puertos y directorios
  const portParams = pkg.ports.split(',').map(p => `-p ${p}`).join(' ');
  const nameParam = `--name ${packageKey}-nas`;
  const restartParam = '--restart unless-stopped';
  const runCommand = `docker run -d ${nameParam} ${restartParam} ${portParams} ${pkg.image}`;

  return new Promise((resolve) => {
    exec(runCommand, (error, stdout) => {
      if (error) {
        // Si hay error porque ya existe el nombre, tratar de iniciarlo
        if (error.message.includes('already in use')) {
          exec(`docker start ${packageKey}-nas`, (startErr) => {
            if (startErr) {
              resolve({ success: false, error: error.message });
            } else {
              resolve({ success: true, message: `La aplicación ${pkg.name} ya existía y fue iniciada.` });
            }
          });
        } else {
          resolve({ success: false, error: error.message });
        }
      } else {
        resolve({ success: true, message: `Aplicación ${pkg.name} instalada y ejecutándose en ID: ${stdout.trim().substring(0, 12)}` });
      }
    });
  });
}

module.exports = {
  getContainers,
  startContainer,
  stopContainer,
  removeContainer,
  installPackage
};
