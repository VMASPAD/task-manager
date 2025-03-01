// src-tauri/src/main.rs
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use serde::{Serialize, Deserialize};
use std::process::Command;
use std::collections::HashMap;
use sysinfo::{ProcessExt, System, SystemExt, PidExt};
use tauri::{State, Manager};
use std::sync::{Arc, Mutex};
use windows::Win32::NetworkManagement::IpHelper::{GetExtendedTcpTable, TCP_TABLE_CLASS, MIB_TCPROW_OWNER_PID};
use windows::Win32::Foundation::ERROR_INSUFFICIENT_BUFFER;
use windows::core::PWSTR;
use std::mem;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ProcessInfo {
    pid: u32,
    name: String,
    cpu_usage: f32,
    memory_usage: u64,      // En bytes
    disk_read_bytes: u64,
    disk_write_bytes: u64,
    gpu_usage: f32,         // En porcentaje
    parent_pid: Option<u32>, // PID del proceso padre
    has_children: bool,     // Indica si tiene subprocesos
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ProcessTree {
    processes: Vec<ProcessInfo>,
    process_relationships: HashMap<u32, Vec<u32>>, // Mapa de PID a lista de PIDs hijos
}

struct AppState {
    system: Arc<Mutex<System>>,
}

#[tauri::command]
fn get_processes(state: State<AppState>) -> ProcessTree {
    let mut system = state.system.lock().unwrap();
    system.refresh_all();
    
    let mut processes = Vec::new();
    let mut process_relationships: HashMap<u32, Vec<u32>> = HashMap::new();
    let mut process_parents: HashMap<u32, Option<u32>> = HashMap::new();
    
    // Primera pasada: recopilar todos los procesos y sus PIDs
    for (pid, process) in system.processes() {
        let pid_u32 = pid.as_u32();
        process_parents.insert(pid_u32, None);
        process_relationships.insert(pid_u32, Vec::new());
    }
    
    // Segunda pasada: establecer relaciones padre-hijo
    for (pid, process) in system.processes() {
        let pid_u32 = pid.as_u32();
        
        if let Some(parent_pid) = process.parent() {
            let parent_pid_u32 = parent_pid.as_u32();
            process_parents.insert(pid_u32, Some(parent_pid_u32));
            
            // Agregar a la lista de hijos del padre
            if let Some(children) = process_relationships.get_mut(&parent_pid_u32) {
                children.push(pid_u32);
            }
        }
    }
    
    // Tercera pasada: crear la información del proceso
    for (pid, process) in system.processes() {
        let pid_u32 = pid.as_u32();
        let parent_pid = process_parents.get(&pid_u32).unwrap_or(&None).clone();
        let has_children = !process_relationships.get(&pid_u32).unwrap_or(&Vec::new()).is_empty();
        
        processes.push(ProcessInfo {
            pid: pid_u32,
            name: process.name().to_string(),
            cpu_usage: process.cpu_usage(),
            memory_usage: process.memory(),
            disk_read_bytes: process.disk_usage().read_bytes,
            disk_write_bytes: process.disk_usage().written_bytes,
            gpu_usage: get_gpu_usage(&process.name()),
            parent_pid,
            has_children,
        });
    }
    
    ProcessTree {
        processes,
        process_relationships,
    }
}

#[tauri::command]
fn kill_process(pid: u32) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        match Command::new("taskkill").args(&["/F", "/PID", &pid.to_string()]).output() {
            Ok(output) => {
                if output.status.success() {
                    Ok(true)
                } else {
                    let error = String::from_utf8_lossy(&output.stderr).to_string();
                    Err(format!("No se pudo terminar el proceso: {}", error))
                }
            },
            Err(e) => Err(format!("Error al ejecutar taskkill: {}", e)),
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Err("Esta función solo está disponible en Windows".to_string())
    }
}

 
fn get_gpu_usage(process_name: &str) -> f32 {
    // Para obtener el uso real de GPU necesitarías usar NVML (NVIDIA) o
    // las APIs AMD equivalentes. Esto es un placeholder.
    
    // Podría implementarse usando el comando "nvidia-smi" en sistemas con GPU NVIDIA
    match Command::new("nvidia-smi")
        .args(&["--query-compute-apps=pid,used_memory", "--format=csv,noheader"])
        .output() {
            Ok(output) => {
                // Analizar la salida para encontrar el PID y extraer uso de GPU
                // Este es un ejemplo simplificado
                0.0
            },
            Err(_) => 0.0,
        }
}

fn main() {
    let system = Arc::new(Mutex::new(System::new_all()));
    
    tauri::Builder::default()
        .manage(AppState { system })
        .invoke_handler(tauri::generate_handler![get_processes, kill_process])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}