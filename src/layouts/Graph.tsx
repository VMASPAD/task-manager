import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { invoke } from '@tauri-apps/api/core';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Tipo para los datos de procesos que recibimos de Rust
interface ProcessInfo {
  pid: number;
  name: string;
  cpu_usage: number;
  memory_usage: number;
  disk_read_bytes: number;
  disk_write_bytes: number;
  network_rx_bytes: number;
  network_tx_bytes: number;
  gpu_usage: number;
  parent_pid: number | null;
  has_children: boolean;
}

interface ProcessTree {
  processes: ProcessInfo[];
  process_relationships: Record<number, number[]>;
}

const Graph = () => {
  // Estado para almacenar los datos históricos de los procesos
  const [processHistory, setProcessHistory] = useState<{
    timestamps: string[];
    cpuData: { [pid: number]: (number | null)[] };
    memoryData: { [pid: number]: (number | null)[] };
    diskReadData: { [pid: number]: (number | null)[] };
    diskWriteData: { [pid: number]: (number | null)[] };
    networkRxData: { [pid: number]: (number | null)[] };
    networkTxData: { [pid: number]: (number | null)[] };
    gpuData: { [pid: number]: (number | null)[] };
    processNames: { [pid: number]: string };
  }>({
    timestamps: [],
    cpuData: {},
    memoryData: {},
    diskReadData: {},
    diskWriteData: {},
    networkRxData: {},
    networkTxData: {},
    gpuData: {},
    processNames: {},
  });

  // Lista de procesos seleccionados para mostrar
  const [selectedProcesses, setSelectedProcesses] = useState<number[]>([]);
  // Flag para indicar si ya se hizo la selección inicial
  const [initialSelectionMade, setInitialSelectionMade] = useState(false);
  
  // Controles para mostrar/ocultar métricas
  const [showCPU, setShowCPU] = useState(true);
  const [showMemory, setShowMemory] = useState(true);
  const [showDiskRead, setShowDiskRead] = useState(false);
  const [showDiskWrite, setShowDiskWrite] = useState(false);
  const [showNetworkRx, setShowNetworkRx] = useState(false);
  const [showNetworkTx, setShowNetworkTx] = useState(false);
  const [showGPU, setShowGPU] = useState(false);
  
  // Lista de todos los procesos disponibles
  const [availableProcesses, setAvailableProcesses] = useState<ProcessInfo[]>([]);

  // Función para actualizar los datos
  const fetchProcessData = async () => {
    try {
      const data: ProcessTree = await invoke('get_processes');
      
      // Actualizar la lista de procesos disponibles, manteniendo los PIDs originales
      // que estaban seleccionados, incluso si algunos procesos han terminado
      const newAvailableProcesses = data.processes;
      
      setAvailableProcesses(prevProcesses => {
        // Crear un nuevo array que conserve los procesos anteriores que ya no existen
        // en la nueva lista pero que estaban seleccionados
        const existingPids = new Set(newAvailableProcesses.map(p => p.pid));
        const missingSelectedProcesses = prevProcesses
          .filter(p => !existingPids.has(p.pid) && selectedProcesses.includes(p.pid));
        
        return [...newAvailableProcesses, ...missingSelectedProcesses];
      });
      
      // Si es la primera carga y no se ha hecho la selección inicial,
      // seleccionar automáticamente los 5 procesos con mayor uso de CPU
      if (!initialSelectionMade) {
        const topProcesses = [...data.processes]
          .sort((a, b) => b.cpu_usage - a.cpu_usage)
          .slice(0, 5)
          .map(p => p.pid);
        setSelectedProcesses(topProcesses);
        setInitialSelectionMade(true);
      }
      
      // Actualizar histórico
      const timestamp = new Date().toLocaleTimeString();
      
      setProcessHistory(prev => {
        // Limitar a las últimas 30 muestras
        const timestamps = [...prev.timestamps, timestamp].slice(-30);
        
        // Inicializar objetos para los nuevos datos
        const cpuData = { ...prev.cpuData };
        const memoryData = { ...prev.memoryData };
        const diskReadData = { ...prev.diskReadData };
        const diskWriteData = { ...prev.diskWriteData };
        const networkRxData = { ...prev.networkRxData };
        const networkTxData = { ...prev.networkTxData };
        const gpuData = { ...prev.gpuData };
        const processNames = { ...prev.processNames };
        
        // Actualizar datos para cada proceso
        data.processes.forEach(process => {
          const { pid } = process;
          
          // Inicializar arrays si no existen
          if (!cpuData[pid]) cpuData[pid] = [];
          if (!memoryData[pid]) memoryData[pid] = [];
          if (!diskReadData[pid]) diskReadData[pid] = [];
          if (!diskWriteData[pid]) diskWriteData[pid] = [];
          if (!networkRxData[pid]) networkRxData[pid] = [];
          if (!networkTxData[pid]) networkTxData[pid] = [];
          if (!gpuData[pid]) gpuData[pid] = [];
          
          // Agregar nuevos datos y limitar a las últimas 30 muestras
          cpuData[pid] = [...cpuData[pid], process.cpu_usage].slice(-30);
          memoryData[pid] = [...memoryData[pid], process.memory_usage / (1024 * 1024)].slice(-30); // MB
          diskReadData[pid] = [...diskReadData[pid], process.disk_read_bytes / 1024].slice(-30); // KB
          diskWriteData[pid] = [...diskWriteData[pid], process.disk_write_bytes / 1024].slice(-30); // KB
          networkRxData[pid] = [...networkRxData[pid], process.network_rx_bytes / 1024].slice(-30); // KB
          networkTxData[pid] = [...networkTxData[pid], process.network_tx_bytes / 1024].slice(-30); // KB
          gpuData[pid] = [...gpuData[pid], process.gpu_usage].slice(-30);
          
          // Actualizar nombre del proceso
          processNames[pid] = process.name;
        });
        
        // Para procesos seleccionados que ya no existen, mantener sus datos anteriores
        // pero no agregar nuevos puntos
        selectedProcesses.forEach(pid => {
          if (!data.processes.some(p => p.pid === pid)) {
            // Si el proceso ya no existe, mantenerlo en el historial
            if (cpuData[pid] && cpuData[pid].length > 0) {
              cpuData[pid] = [...cpuData[pid], null].slice(-30);
              memoryData[pid] = [...memoryData[pid], null].slice(-30);
              diskReadData[pid] = [...diskReadData[pid], null].slice(-30);
              diskWriteData[pid] = [...diskWriteData[pid], null].slice(-30);
              networkRxData[pid] = [...networkRxData[pid], null].slice(-30);
              networkTxData[pid] = [...networkTxData[pid], null].slice(-30);
              gpuData[pid] = [...gpuData[pid], null].slice(-30);
            }
          }
        });
        
        return {
          timestamps,
          cpuData,
          memoryData,
          diskReadData,
          diskWriteData,
          networkRxData,
          networkTxData,
          gpuData,
          processNames,
        };
      });
    } catch (error) {
      console.error('Error fetching process data:', error);
    }
  };
  
  // Efecto para cargar datos iniciales y configurar el intervalo
  useEffect(() => {
    fetchProcessData();
    
    // Cambiar el intervalo a 5 segundos (5000 ms)
    const interval = setInterval(fetchProcessData, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Función para generar colores diferentes para cada proceso
  const getColor = (index: number, opacity: number = 1) => {
    const colors = [
      `rgba(255, 99, 132, ${opacity})`,
      `rgba(54, 162, 235, ${opacity})`,
      `rgba(255, 206, 86, ${opacity})`,
      `rgba(75, 192, 192, ${opacity})`,
      `rgba(153, 102, 255, ${opacity})`,
      `rgba(255, 159, 64, ${opacity})`,
      `rgba(199, 199, 199, ${opacity})`,
      `rgba(83, 102, 255, ${opacity})`,
      `rgba(40, 167, 69, ${opacity})`,
      `rgba(220, 53, 69, ${opacity})`,
    ];
    return colors[index % colors.length];
  };
  
  // Preparar los datasets para el gráfico
  const getChartData = () => {
    const datasets: any[] = [];
    
    selectedProcesses.forEach((pid, index) => {
      const processName = processHistory.processNames[pid] || `PID ${pid}`;
      
      if (showCPU) {
        datasets.push({
          label: `CPU - ${processName}`,
          data: processHistory.cpuData[pid] || [],
          borderColor: getColor(index),
          backgroundColor: getColor(index, 0.2),
          borderWidth: 2,
          pointRadius: 1,
          yAxisID: 'cpu',
          spanGaps: true, // Para manejar valores null en los datos
        });
      }
      
      if (showMemory) {
        datasets.push({
          label: `Memoria (MB) - ${processName}`,
          data: processHistory.memoryData[pid] || [],
          borderColor: getColor(index + 10),
          backgroundColor: getColor(index + 10, 0.2),
          borderWidth: 2,
          pointRadius: 1,
          yAxisID: 'memory',
          spanGaps: true,
        });
      }
      
      if (showDiskRead) {
        datasets.push({
          label: `Lectura Disco (KB) - ${processName}`,
          data: processHistory.diskReadData[pid] || [],
          borderColor: getColor(index + 20),
          backgroundColor: getColor(index + 20, 0.2),
          borderWidth: 2,
          pointRadius: 1,
          yAxisID: 'disk',
          spanGaps: true,
        });
      }
      
      if (showDiskWrite) {
        datasets.push({
          label: `Escritura Disco (KB) - ${processName}`,
          data: processHistory.diskWriteData[pid] || [],
          borderColor: getColor(index + 30),
          backgroundColor: getColor(index + 30, 0.2),
          borderWidth: 2,
          pointRadius: 1,
          yAxisID: 'disk',
          spanGaps: true,
        });
      }
      
      if (showNetworkRx) {
        datasets.push({
          label: `Red RX (KB) - ${processName}`,
          data: processHistory.networkRxData[pid] || [],
          borderColor: getColor(index + 40),
          backgroundColor: getColor(index + 40, 0.2),
          borderWidth: 2,
          pointRadius: 1,
          yAxisID: 'network',
          spanGaps: true,
        });
      }
      
      if (showNetworkTx) {
        datasets.push({
          label: `Red TX (KB) - ${processName}`,
          data: processHistory.networkTxData[pid] || [],
          borderColor: getColor(index + 50),
          backgroundColor: getColor(index + 50, 0.2),
          borderWidth: 2,
          pointRadius: 1,
          yAxisID: 'network',
          spanGaps: true,
        });
      }
      
      if (showGPU) {
        datasets.push({
          label: `GPU (%) - ${processName}`,
          data: processHistory.gpuData[pid] || [],
          borderColor: getColor(index + 60),
          backgroundColor: getColor(index + 60, 0.2),
          borderWidth: 2,
          pointRadius: 1,
          yAxisID: 'gpu',
          spanGaps: true,
        });
      }
    });
    
    return {
      labels: processHistory.timestamps,
      datasets,
    };
  };
  
  // Opciones del gráfico
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Tiempo',
        },
      },
      cpu: {
        type: 'linear' as const,
        display: showCPU,
        position: 'left' as const,
        title: {
          display: true,
          text: 'CPU (%)',
        },
        min: 0,
      },
      memory: {
        type: 'linear' as const,
        display: showMemory,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Memoria (MB)',
        },
        min: 0,
        grid: {
          drawOnChartArea: false,
        },
      },
      disk: {
        type: 'linear' as const,
        display: showDiskRead || showDiskWrite,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Disco (KB)',
        },
        min: 0,
        grid: {
          drawOnChartArea: false,
        },
      },
      network: {
        type: 'linear' as const,
        display: showNetworkRx || showNetworkTx,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Red (KB)',
        },
        min: 0,
        grid: {
          drawOnChartArea: false,
        },
      },
      gpu: {
        type: 'linear' as const,
        display: showGPU,
        position: 'right' as const,
        title: {
          display: true,
          text: 'GPU (%)',
        },
        min: 0,
        max: 100,
        grid: {
          drawOnChartArea: false,
        },
      },
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
  };
  
  // Función para manejar la selección de procesos
  const handleProcessSelect = (pid: number) => {
    setSelectedProcesses(prev => 
      prev.includes(pid)
        ? prev.filter(p => p !== pid)
        : [...prev, pid]
    );
  };
  
  // Función para ordenar procesos por uso de CPU y estado de selección
  const sortProcesses = (processes: ProcessInfo[]) => {
    return [...processes].sort((a, b) => {
      // Primero los seleccionados
      const aSelected = selectedProcesses.includes(a.pid);
      const bSelected = selectedProcesses.includes(b.pid);
      
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      
      // Luego por uso de CPU
      return b.cpu_usage - a.cpu_usage;
    });
  };
  
  return (
    <div className="flex flex-col w-full h-full p-4 space-y-4">
      <div className="flex flex-wrap gap-2 p-2 bg-gray-100 rounded">
        <div className="text-sm font-bold">Métricas:</div>
        <label className="flex items-center space-x-1">
          <input
            type="checkbox"
            checked={showCPU}
            onChange={() => setShowCPU(!showCPU)}
            className="form-checkbox"
          />
          <span>CPU</span>
        </label>
        <label className="flex items-center space-x-1">
          <input
            type="checkbox"
            checked={showMemory}
            onChange={() => setShowMemory(!showMemory)}
            className="form-checkbox"
          />
          <span>Memoria</span>
        </label>
        <label className="flex items-center space-x-1">
          <input
            type="checkbox"
            checked={showDiskRead}
            onChange={() => setShowDiskRead(!showDiskRead)}
            className="form-checkbox"
          />
          <span>Lectura Disco</span>
        </label>
        <label className="flex items-center space-x-1">
          <input
            type="checkbox"
            checked={showDiskWrite}
            onChange={() => setShowDiskWrite(!showDiskWrite)}
            className="form-checkbox"
          />
          <span>Escritura Disco</span>
        </label>
        <label className="flex items-center space-x-1">
          <input
            type="checkbox"
            checked={showNetworkRx}
            onChange={() => setShowNetworkRx(!showNetworkRx)}
            className="form-checkbox"
          />
          <span>Red RX</span>
        </label>
        <label className="flex items-center space-x-1">
          <input
            type="checkbox"
            checked={showNetworkTx}
            onChange={() => setShowNetworkTx(!showNetworkTx)}
            className="form-checkbox"
          />
          <span>Red TX</span>
        </label>
        <label className="flex items-center space-x-1">
          <input
            type="checkbox"
            checked={showGPU}
            onChange={() => setShowGPU(!showGPU)}
            className="form-checkbox"
          />
          <span>GPU</span>
        </label>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 h-96 bg-white p-4 rounded shadow">
          <Line data={getChartData()} options={chartOptions} />
        </div>
        
        <div className="bg-white p-4 rounded shadow overflow-y-auto max-h-96">
          <h3 className="font-bold mb-2">Procesos</h3>
          <div className="space-y-1">
            {sortProcesses(availableProcesses).map(process => (
              <label 
                key={process.pid} 
                className={`flex items-center p-1 hover:bg-gray-100 rounded ${
                  selectedProcesses.includes(process.pid) ? "bg-blue-50" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedProcesses.includes(process.pid)}
                  onChange={() => handleProcessSelect(process.pid)}
                  className="mr-2"
                />
                <span className="truncate">
                  {process.name} ({process.pid}) - CPU: {process.cpu_usage.toFixed(1)}%
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Graph;