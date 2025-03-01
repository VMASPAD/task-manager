# Task Manager

## Description
Task Manager is a modern desktop application built with Tauri and React that provides an intuitive graphical interface for monitoring and managing system processes on Windows. The application offers functionality similar to the Windows Task Manager but with a more modern interface and additional features.

## Key Features

- 📊 **Real-time Process Monitoring**
  - CPU, RAM and Disk usage tracking
  - Hierarchical view of processes (parent-child relationships)
  - Auto-refresh every 5 seconds

- 📈 **Real-time Performance Graphs**
  - Visual representation of system metrics
  - Support for tracking multiple processes simultaneously
  - Customizable filters for different metrics

- 🔍 **Advanced Functionality**
  - Real-time process search
  - Sortable metrics (CPU, memory, disk I/O)
  - Safe process termination
  - Network traffic monitoring (TX/RX)

## Technology Stack

- **Frontend:** React, TypeScript, TailwindCSS
- **Backend:** Rust with Tauri
- **System Information:** sysinfo, Windows API

## Screenshots

_[Add screenshots here]_

## Installation

### Prerequisites
- Windows 10/11
- [Rust](https://www.rust-lang.org/tools/install)
- [Node.js](https://nodejs.org/) (v16+)

### Steps
1. Clone this repository
   ```bash
   git clone https://github.com/yourusername/task-manager.git
   cd task-manager
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Build the application
   ```bash
   npm run tauri build
   ```

4. The executable will be available in the `src-tauri/target/release` directory

## Development

1. Clone the repository and install dependencies as shown above

2. Run in development mode
   ```bash
   npm run tauri dev
   ```

## Permissions

This application requires elevated privileges to:
- Access process information
- Monitor system resources
- Terminate processes

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Acknowledgements

- [Tauri](https://tauri.app/)
- [React](https://reactjs.org/)
- [sysinfo](https://github.com/GuillaumeGomez/sysinfo)
- [Chart.js](https://www.chartjs.org/)

Código similar encontrado con 2 tipos de licencias