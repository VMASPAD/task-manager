// src/App.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { ArrowBigRight } from 'lucide-react';

interface ProcessData {
    processes: Array<{
      pid: number;
      name: string;
      cpu_usage: number;
      memory_usage: number;
      disk_read_bytes: number;
      disk_write_bytes: number;
      gpu_usage: number;
      parent_pid?: number;
      has_children: boolean;
    }>;
    process_relationships: Record<string, number[]>;
  }

function Process() {
  const [processData, setProcessData] = useState<ProcessData>({ processes: [], process_relationships: {} });
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'cpu_usage', direction: 'desc' });
  const [error, setError] = useState<string |null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedProcesses, setExpandedProcesses] = useState(new Set());
  interface Notification {
    type: 'success' | 'error';
    message: string;
  }

  interface ProcessInfo {
    pid: number;
    name: string;
    cpu_usage: number;
    memory_usage: number;
    disk_read_bytes: number;
    disk_write_bytes: number;
    gpu_usage: number;
    parent_pid?: number;
    has_children: boolean;
  }

  const [notification, setNotification] = useState<Notification | null>(null);
  const [confirmKill, setConfirmKill] = useState<ProcessInfo | null>(null);

  const fetchProcesses = useCallback(async () => {
    try {
      if (loading) {
        setLoading(true);
      }
      const data = await invoke<ProcessData>('get_processes');
      setProcessData(data);
      setError(null);
    } catch (error) {
      console.error("Error fetching processes:", error);
      setError("Error al obtener datos de procesos.");
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    fetchProcesses();
    // Actualizar cada 5 segundos
    const interval = setInterval(fetchProcesses, 5000);
    return () => clearInterval(interval);
  }, [fetchProcesses]);

  const requestSort = (key: string) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleKillProcess = async (pid: any) => {
    setConfirmKill(null);
    try {
      setLoading(true);
      const result = await invoke('kill_process', { pid });
      if (result) {
        setNotification({
          type: 'success',
          message: `Proceso con PID ${pid} terminado correctamente.`
        });
        // Recargar la lista de procesos
        fetchProcesses();
      }
    } catch (error) {
      setNotification({
        type: 'error',
        message: `Error al terminar el proceso: ${error}`
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleExpandProcess = (pid: unknown) => {
    setExpandedProcesses(prevExpanded => {
      const newExpanded = new Set(prevExpanded);
      if (newExpanded.has(pid)) {
        newExpanded.delete(pid);
      } else {
        newExpanded.add(pid);
      }
      return newExpanded;
    });
  };

  const filteredProcesses = useMemo(() => {
    // Filtrar primero por término de búsqueda
    const filtered = processData.processes.filter((process) => 
      process.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    // Ordenar los procesos filtrados
    return [...filtered].sort((a, b) => {
      const aValue = a[sortConfig.key as keyof typeof a];
      const bValue = b[sortConfig.key as keyof typeof b];
      
      if (aValue === undefined && bValue === undefined) {
        return 0;
      }
      if (aValue === undefined) {
        return 1; // Undefined values go last
      }
      if (bValue === undefined) {
        return -1; // Undefined values go last
      }
      
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [processData.processes, searchTerm, sortConfig]);

  // Obtener solo procesos de nivel superior (sin padre o con padre desconocido)
  const topLevelProcesses = useMemo(() => {
    return filteredProcesses.filter(process => 
      !process.parent_pid || !processData.processes.some(p => p.pid === process.parent_pid)
    );
  }, [filteredProcesses, processData.processes]);

  // Obtener subprocesos por PID
  const getChildProcesses = (parentPid: number | undefined) => {
    return filteredProcesses.filter(process => process.parent_pid === parentPid);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Renderiza un proceso y sus hijos recursivamente
  const renderProcess = (process: any, depth = 0): JSX.Element => {
    if (!process) return <></>;
    const childProcesses = getChildProcesses(process.pid);
    const isExpanded = expandedProcesses.has(process.pid);
    
    return (
      <>
        <tr 
          key={process.pid} 
          className={`hover:bg-gray-50 transition-colors ${depth > 0 ? 'bg-gray-50' : ''}`}
        >
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {process.pid}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
            <div className="flex items-center">
              {process.has_children && (
                <button 
                  onClick={() => toggleExpandProcess(process.pid)}
                  className="mr-2 text-gray-500 hover:text-gray-700 focus:outline-none"
                >
                  <span className="inline-block transform transition-transform duration-200" style={{ 
                    marginLeft: `${depth * 20}px`,
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                  }}>
                    <ArrowBigRight />
                  </span>
                </button>
              )}
              {!process.has_children && depth > 0 && (
                <span className="mr-6" style={{ marginLeft: `${depth * 20}px` }}></span>
              )}
              {process.name}
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            <div className="flex items-center">
              <span className="mr-2">{process.cpu_usage.toFixed(1)}</span>
              <div className="w-16 bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full" 
                  style={{ width: `${Math.min(100, process.cpu_usage)}%` }}
                ></div>
              </div>
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {formatBytes(process.memory_usage)}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {formatBytes(process.disk_read_bytes)}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {formatBytes(process.disk_write_bytes)}
          </td>
        
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            <div className="flex items-center">
              <span className="mr-2">{process.gpu_usage.toFixed(1)}</span>
              <div className="w-16 bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-green-500 h-2.5 rounded-full" 
                  style={{ width: `${Math.min(100, process.gpu_usage)}%` }}
                ></div>
              </div>
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
            <button
              onClick={() => setConfirmKill(process)}
              className="text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 px-3 py-1 rounded text-xs"
            >
              Terminar
            </button>
          </td>
        </tr>
        
        {/* Renderizar procesos hijos si está expandido */}
        {isExpanded && childProcesses.map(childProcess => renderProcess(childProcess, depth + 1))}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Monitor de Procesos de Windows</h1>
        
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
            <p>{error}</p>
          </div>
        )}
        
        {notification && (
          <div 
            className={`${notification.type === 'success' ? 'bg-green-100 border-green-500 text-green-700' : 'bg-red-100 border-red-500 text-red-700'} border-l-4 p-4 mb-4`}
            role="alert"
          >
            <div className="flex">
              <div>
                <p>{notification.message}</p>
              </div>
              <button
                className="ml-auto -mx-1.5 -my-1.5 rounded-lg p-1.5 inline-flex h-8 w-8 focus:outline-none"
                onClick={() => setNotification(null)}
              >
                <span className="sr-only">Cerrar</span>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
                </svg>
              </button>
            </div>
          </div>
        )}
        
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-4 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {processData.processes.length} procesos activos | {topLevelProcesses.length} procesos principales
            </div>
            
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </div>
              <input
                type="search"
                className="block p-2 pl-10 w-64 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Buscar por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="text-sm text-gray-600">
              Actualizando cada 5 segundos
              {loading && <span className="ml-2 inline-block h-4 w-4 rounded-full border-2 border-t-blue-500 animate-spin"></span>}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th 
                    onClick={() => requestSort('pid')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    PID
                    {sortConfig.key === 'pid' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    onClick={() => requestSort('name')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Proceso
                    {sortConfig.key === 'name' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    onClick={() => requestSort('cpu_usage')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    CPU (%)
                    {sortConfig.key === 'cpu_usage' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    onClick={() => requestSort('memory_usage')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    RAM
                    {sortConfig.key === 'memory_usage' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    onClick={() => requestSort('disk_read_bytes')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Lectura Disco
                    {sortConfig.key === 'disk_read_bytes' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    onClick={() => requestSort('disk_write_bytes')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Escritura Disco
                    {sortConfig.key === 'disk_write_bytes' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                 
                  <th 
                    onClick={() => requestSort('gpu_usage')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    GPU (%)
                    {sortConfig.key === 'gpu_usage' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {/* Renderizar solo procesos de nivel superior cuando no hay búsqueda */}
                {searchTerm === '' 
                  ? topLevelProcesses.map(process => renderProcess(process))
                  : filteredProcesses.map(process => renderProcess(process))
                }
                
                {filteredProcesses.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-4 text-center text-sm text-gray-500">
                      No se encontraron procesos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Modal de confirmación para terminar proceso */}
      {confirmKill && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 className="text-lg font-medium text-gray-900">Terminar proceso</h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    ¿Estás seguro de que deseas terminar el proceso <span className="font-bold">{confirmKill.name}</span> (PID: {confirmKill.pid})?
                    Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={() => handleKillProcess(confirmKill.pid)}
              >
                Terminar
              </button>
              <button
                type="button"
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                onClick={() => setConfirmKill(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Process;