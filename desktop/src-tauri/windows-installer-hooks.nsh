!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Stopping running 网脉智能体 sidecars..."
  nsExec::ExecToLog 'taskkill /F /T /IM wangmai-sidecar-x86_64-pc-windows-msvc.exe'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /T /IM wangmai-sidecar-aarch64-pc-windows-msvc.exe'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /T /IM wangmai-sidecar.exe'
  Pop $0
  Sleep 1000
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "Stopping running 网脉智能体 processes..."
  nsExec::ExecToLog 'taskkill /F /T /IM wangmai-desktop.exe'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /T /IM wangmai-sidecar-x86_64-pc-windows-msvc.exe'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /T /IM wangmai-sidecar-aarch64-pc-windows-msvc.exe'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /T /IM wangmai-sidecar.exe'
  Pop $0
  Sleep 1000
!macroend
