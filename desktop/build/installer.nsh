!include "LogicLib.nsh"
!include "getProcessInfo.nsh"
!include "${BUILD_RESOURCES_DIR}\check-install-processes.nsh"
!define /ifndef INSTALL_REGISTRY_KEY "Software\${APP_GUID}"
!define /ifndef UNINSTALL_REGISTRY_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}"
Var pid
Var wangmaiProcessDiagnostic
Var wangmaiProcessHelperWriteBlocked

!ifndef BUILD_UNINSTALLER
Var wangmaiRecoveryDone
Var wangmaiPerUserInstallLocation
Var wangmaiPerMachineInstallLocation
Var wangmaiPerUserUninstallString
Var wangmaiPerMachineUninstallString

Function WangMaiUninstallerParent
  Exch $R0
  Push $R1
  Push $R2
  Push $R3

  StrCpy $R2 0

  wangmai_uninstall_parent_find_first_quote:
    StrCpy $R1 $R0 1 $R2
    StrCmp $R1 "" wangmai_uninstall_parent_invalid
    StrCmp $R1 '"' wangmai_uninstall_parent_after_first_quote
    IntOp $R2 $R2 + 1
    Goto wangmai_uninstall_parent_find_first_quote

  wangmai_uninstall_parent_after_first_quote:
    IntOp $R2 $R2 + 1
    StrCpy $R0 $R0 "" $R2
    StrCpy $R2 0

  wangmai_uninstall_parent_find_second_quote:
    StrCpy $R1 $R0 1 $R2
    StrCmp $R1 "" wangmai_uninstall_parent_invalid
    StrCmp $R1 '"' wangmai_uninstall_parent_have_file
    IntOp $R2 $R2 + 1
    Goto wangmai_uninstall_parent_find_second_quote

  wangmai_uninstall_parent_have_file:
    StrCpy $R0 $R0 $R2
    StrLen $R2 $R0

  wangmai_uninstall_parent_find_slash:
    IntOp $R2 $R2 - 1
    IntCmp $R2 0 wangmai_uninstall_parent_invalid 0 0
    StrCpy $R1 $R0 1 $R2
    StrCmp $R1 "\" wangmai_uninstall_parent_done
    Goto wangmai_uninstall_parent_find_slash

  wangmai_uninstall_parent_invalid:
    StrCpy $R0 ""
    Goto wangmai_uninstall_parent_done

  wangmai_uninstall_parent_done:
    StrCpy $R0 $R0 $R2
    Pop $R3
    Pop $R2
    Pop $R1
    Exch $R0
FunctionEnd

Function WangMaiFinalInstallDir
  Exch $R0
  Push $R1
  Push $R2
  Push $R3
  Push $R4
  Push $R5

  StrCpy $R1 "${APP_FILENAME}"
  StrLen $R2 $R1
  StrLen $R3 $R0
  StrCpy $R4 0

  wangmai_final_install_find_name:
    IntCmp $R4 $R3 wangmai_final_install_append 0 wangmai_final_install_append
    StrCpy $R5 $R0 $R2 $R4
    StrCmp $R5 $R1 wangmai_final_install_done
    IntOp $R4 $R4 + 1
    Goto wangmai_final_install_find_name

  wangmai_final_install_append:
    StrCpy $R0 "$R0\${APP_FILENAME}"

  wangmai_final_install_done:
    Pop $R5
    Pop $R4
    Pop $R3
    Pop $R2
    Pop $R1
    Exch $R0
FunctionEnd

Function WangMaiCanSkipLegacyRecovery
  Push $R3
  Push $R0
  Push $R1
  Push $R2

  StrCpy $R0 "0"
  ${If} $8 != "trusted-user"
    Goto wangmai_skip_recovery_done
  ${EndIf}
  ${If} $wangmaiPerUserInstallLocation == ""
    Goto wangmai_skip_recovery_done
  ${EndIf}
  ${If} $wangmaiPerMachineInstallLocation != ""
    Goto wangmai_skip_recovery_done
  ${EndIf}
  ${If} $wangmaiPerMachineUninstallString != ""
    Goto wangmai_skip_recovery_done
  ${EndIf}
  StrCmp $wangmaiPerUserInstallLocation $INSTDIR 0 wangmai_skip_recovery_done

  ReadEnvStr $R1 APPDATA
  ${If} $R1 == ""
    Goto wangmai_skip_recovery_done
  ${EndIf}
  ReadEnvStr $R0 CLAUDE_CONFIG_DIR
  ${If} $R0 != ""
    StrCpy $R0 "0"
    Goto wangmai_skip_recovery_done
  ${EndIf}
  StrCpy $R0 "0"

  IfFileExists "$wangmaiPerUserInstallLocation\CLAUDE_CONFIG_DIR\*.*" wangmai_skip_recovery_done 0
  IfFileExists "$R1\网脉智能体\app-mode.json" wangmai_check_default_mode 0
  StrCpy $R0 "1"
  Goto wangmai_skip_recovery_done

  wangmai_check_default_mode:
    ClearErrors
    FileOpen $R2 "$R1\网脉智能体\app-mode.json" r
    IfErrors wangmai_skip_recovery_done 0
    FileRead $R2 $R3
    StrCmp $R3 '{$\n' 0 wangmai_close_mode_file
    FileRead $R2 $R3
    StrCmp $R3 '  "mode": "default",$\n' 0 wangmai_close_mode_file
    FileRead $R2 $R3
    StrCmp $R3 '  "portable_dir": null$\n' 0 wangmai_close_mode_file
    FileRead $R2 $R3
    StrCmp $R3 '}' 0 wangmai_close_mode_file
    ClearErrors
    FileRead $R2 $R3
    IfErrors 0 wangmai_close_mode_file
    StrCpy $R0 "1"

  wangmai_close_mode_file:
    FileClose $R2

  wangmai_skip_recovery_done:
    StrCpy $R3 $R0
    Pop $R2
    Pop $R1
    Pop $R0
    Exch $R3
FunctionEnd

Function WangMaiRecoverLegacy
  ReadRegStr $4 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
  ReadRegStr $5 HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
  ReadRegStr $R0 HKCU "${UNINSTALL_REGISTRY_KEY}" UninstallString
  ${If} $R0 == ""
    !ifdef UNINSTALL_REGISTRY_KEY_2
      ReadRegStr $R0 HKCU "${UNINSTALL_REGISTRY_KEY_2}" UninstallString
    !endif
  ${EndIf}
  ${If} $4 == ""
  ${AndIf} $R0 != ""
    Push $R0
    Call WangMaiUninstallerParent
    Pop $4
  ${EndIf}
  ReadRegStr $R1 HKLM "${UNINSTALL_REGISTRY_KEY}" UninstallString
  ${If} $R1 == ""
    !ifdef UNINSTALL_REGISTRY_KEY_2
      ReadRegStr $R1 HKLM "${UNINSTALL_REGISTRY_KEY_2}" UninstallString
    !endif
  ${EndIf}
  ${If} $5 == ""
  ${AndIf} $R1 != ""
    Push $R1
    Call WangMaiUninstallerParent
    Pop $5
  ${EndIf}

  Push "$INSTDIR"
  Call WangMaiFinalInstallDir
  Pop $9

  ${If} $4 == ""
  ${AndIf} $5 == ""
    StrCpy $0 "0"
    StrCpy $1 "No registered installation needs legacy data recovery"
    DetailPrint "$1"
    Return
  ${EndIf}

  InitPluginsDir
  File /oname=$PLUGINSDIR\recover-legacy-install-data.ps1 "${BUILD_RESOURCES_DIR}\recover-legacy-install-data.ps1"

  ReadEnvStr $2 APPDATA
  ReadEnvStr $3 USERPROFILE
  ReadEnvStr $6 CLAUDE_CONFIG_DIR
  ReadEnvStr $7 WANGMAI_APP_PORTABLE_DIR
  ${If} $2 == ""
    StrCpy $0 "21"
    StrCpy $1 "missing current-user APPDATA"
    Return
  ${EndIf}
  ${If} $3 == ""
    StrCpy $0 "21"
    StrCpy $1 "missing current-user USERPROFILE"
    Return
  ${EndIf}

  DetailPrint "Checking registered installations for legacy 网脉智能体 data..."
  nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\recover-legacy-install-data.ps1" -PerUserInstallDir "$4" -PerMachineInstallDir "$5" -CandidateInstallDir "$9" -UserDataDir "$2\网脉智能体" -RecoveryRoot "$3\网脉智能体 Data\Recovered" -ProcessName "${PRODUCT_FILENAME}.exe" -ActiveConfigDir "$6" -ActiveConfigManaged "$7" -InstallerIdentitySafety "$8"'
  Pop $0
  Pop $1
FunctionEnd

!macro WangMaiRunLegacyRecovery
  ${If} $wangmaiRecoveryDone != "1"
    ReadRegStr $wangmaiPerUserInstallLocation HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
    ReadRegStr $wangmaiPerMachineInstallLocation HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
    ReadRegStr $wangmaiPerUserUninstallString HKCU "${UNINSTALL_REGISTRY_KEY}" UninstallString
    ReadRegStr $wangmaiPerMachineUninstallString HKLM "${UNINSTALL_REGISTRY_KEY}" UninstallString
    !ifdef UNINSTALL_REGISTRY_KEY_2
      ${If} $wangmaiPerUserUninstallString == ""
        ReadRegStr $wangmaiPerUserUninstallString HKCU "${UNINSTALL_REGISTRY_KEY_2}" UninstallString
      ${EndIf}
      ${If} $wangmaiPerMachineUninstallString == ""
        ReadRegStr $wangmaiPerMachineUninstallString HKLM "${UNINSTALL_REGISTRY_KEY_2}" UninstallString
      ${EndIf}
    !endif

    ${If} $wangmaiPerUserInstallLocation == ""
    ${AndIf} $wangmaiPerMachineInstallLocation == ""
    ${AndIf} $wangmaiPerUserUninstallString == ""
    ${AndIf} $wangmaiPerMachineUninstallString == ""
      StrCpy $wangmaiRecoveryDone "1"
      DetailPrint "No registered installation needs legacy data recovery"
    ${Else}
      StrCpy $8 "trusted-user"
      ${If} ${UAC_IsAdmin}
      ${AndIfNot} ${UAC_IsInnerInstance}
        StrCpy $8 "untrusted-elevated"
      ${EndIf}
      ${If} ${UAC_IsInnerInstance}
        StrCpy $8 "trusted-uac-outer"
      ${EndIf}

      Call WangMaiCanSkipLegacyRecovery
      Pop $R0
      ${If} $R0 == "1"
        StrCpy $wangmaiRecoveryDone "1"
        DetailPrint "No legacy data candidates found for the registered per-user installation"
      ${Else}
        ${If} ${UAC_IsInnerInstance}
          !insertmacro UAC_AsUser_Call Function WangMaiRecoverLegacy ${UAC_SYNCREGISTERS}|${UAC_SYNCOUTDIR}|${UAC_SYNCINSTDIR}
        ${Else}
          Call WangMaiRecoverLegacy
        ${EndIf}

        ${If} $0 != "0"
          DetailPrint "Legacy data recovery stopped the installer (helper exit code: $0; output: $1)"
          ${If} $1 == ""
            StrCpy $1 "Recovery helper failed without diagnostic output (exit code $0)"
          ${EndIf}
          StrCpy $R2 "$1" 360
          MessageBox MB_ICONSTOP|MB_OK "网脉智能体 stopped setup before removing the old version. Reason: $R2$\r$\n$\r$\nClose the app and retry. If the reason mentions an elevated installer, launch setup normally instead of using Run as administrator.$\r$\n$\r$\n网脉智能体 已在删除旧版本前停止安装。原因：$R2$\r$\n$\r$\n请关闭旧程序后重试；如果原因提到安装器权限过高，请直接双击运行，不要使用“以管理员身份运行”。旧版本和原数据尚未删除。" /SD IDOK
          SetErrorLevel 20
          Quit
        ${EndIf}
        StrCpy $wangmaiRecoveryDone "1"
        DetailPrint "Legacy 网脉智能体 data safety check completed"
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend
!endif

; electron-builder's IS_POWERSHELL_AVAILABLE runs Get-ExecutionPolicy in
; Windows PowerShell 5.1. When setup inherits a PowerShell 7 PSModulePath (it
; was started from pwsh, or by an app or tool running in pwsh), 5.1 tries to
; load PowerShell 7's Microsoft.PowerShell.Security, the command fails, and
; setup treats PowerShell as unavailable. The tasklist fallback then cannot see
; executable paths and tells the user to close the running app manually.
; Removing the variable lets every PowerShell child build its own default path.
!macro WangMaiUseDefaultPowerShellModulePath
  System::Call 'kernel32::SetEnvironmentVariable(w "PSModulePath", p 0)'
!macroend

!macro WangMaiFindInstallProcess _FILE _RETURN
  ${If} $IsPowerShellAvailable == 0
    nsExec::ExecToStack '"$PowerShellPath" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\check-install-processes.ps1" -InstallDir "$INSTDIR" -ProcessName "${_FILE}" -Action Find -InstallerPid "$pid" -InstallerParentPid "$1"'
    Pop ${_RETURN}
    Pop $wangmaiProcessDiagnostic
    ${If} $wangmaiProcessDiagnostic != ""
      DetailPrint "$wangmaiProcessDiagnostic"
    ${EndIf}
    ; The helper only exits 0 (found or failed closed) or 1 (nothing found).
    ; Anything else means it never ran, e.g. a security tool removed it.
    ${If} ${_RETURN} != 0
    ${AndIf} ${_RETURN} != 1
      DetailPrint "PowerShell process helper did not run (result: ${_RETURN}); using the tasklist fallback."
      StrCpy $IsPowerShellAvailable 1
    ${EndIf}
  ${EndIf}
  ${If} $IsPowerShellAvailable != 0
    Delete "$PLUGINSDIR\wangmai-processes.csv"
    ; No USERNAME filter: it makes tasklist look up the owner of every process,
    ; and that lookup can block forever, which froze setup and the silent
    ; uninstaller with no message. Image names are all this fallback matches; a
    ; same-named process of another user only makes it block setup with the
    ; close-manually message, the fail-closed direction. The timeout turns any
    ; other stall into the enumeration-failed message below: nsExec then pushes
    ; "timeout" (or "error") instead of an exit code, so the result checks must
    ; stay string tests (== / !=); an integer test reads those words as 0.
    nsExec::Exec /TIMEOUT=30000 '"$CmdPath" /D /C tasklist /FO CSV /NH > "$PLUGINSDIR\wangmai-processes.csv"'
    Pop ${_RETURN}
    ${If} ${_RETURN} != 0
      StrCpy $wangmaiProcessDiagnostic "PowerShell unavailable and tasklist process enumeration failed (exit code ${_RETURN}); blocking setup."
      StrCpy ${_RETURN} 0
    ${Else}
      nsExec::Exec /TIMEOUT=30000 '"$SYSDIR\findstr.exe" /I /L /C:"${_FILE}" /C:"wangmai-sidecar-x86_64-pc-windows-msvc.exe" /C:"wangmai-sidecar-aarch64-pc-windows-msvc.exe" /C:"wangmai-sidecar.exe" /C:"OpenConsole.exe" /C:"winpty-agent.exe" /C:"rg.exe" "$PLUGINSDIR\wangmai-processes.csv"'
      Pop ${_RETURN}
      ${If} ${_RETURN} == 0
        StrCpy $wangmaiProcessDiagnostic "PowerShell unavailable; the main app, a known sidecar, or a bundled terminal/search helper is running with an unknown path, possibly in another user's session. Close it manually."
      ${ElseIf} ${_RETURN} == 1
        StrCpy $wangmaiProcessDiagnostic "PowerShell unavailable; exact-image fallback found no main app, known sidecar, or bundled terminal/search helper. Differently named child processes cannot be attributed without path data."
      ${Else}
        StrCpy $wangmaiProcessDiagnostic "PowerShell unavailable and fallback process filtering failed (exit code ${_RETURN}); blocking setup."
        StrCpy ${_RETURN} 0
      ${EndIf}
    ${EndIf}
    DetailPrint "$wangmaiProcessDiagnostic"
  ${EndIf}
!macroend

!macro WangMaiKillInstallProcess _FILE _FORCE
  Push $0
  ${If} ${_FORCE} == 1
    StrCpy $0 "KillForce"
  ${Else}
    StrCpy $0 "Kill"
  ${EndIf}

  ${If} $IsPowerShellAvailable == 0
    nsExec::ExecToStack '"$PowerShellPath" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\check-install-processes.ps1" -InstallDir "$INSTDIR" -ProcessName "${_FILE}" -Action "$0" -InstallerPid "$pid" -InstallerParentPid "$1"'
    Pop $0
    Pop $wangmaiProcessDiagnostic
    ${If} $wangmaiProcessDiagnostic != ""
      DetailPrint "$wangmaiProcessDiagnostic"
    ${EndIf}
  ${Else}
    StrCpy $wangmaiProcessDiagnostic "PowerShell unavailable; refusing to terminate by image name because the executable path is unknown. Close the app manually."
    DetailPrint "$wangmaiProcessDiagnostic"
  ${EndIf}
  Pop $0
!macroend

!macro customCheckAppRunning
  InitPluginsDir
  !insertmacro WangMaiUseDefaultPowerShellModulePath
  !insertmacro IS_POWERSHELL_AVAILABLE
  ${If} $IsPowerShellAvailable == 0
    ; `File` aborts setup when a security tool blocks the .ps1 write (#1486);
    ; a failed FileWrite falls back to the tasklist path instead.
    !insertmacro WangMaiWriteInstallProcessHelper "$PLUGINSDIR\check-install-processes.ps1" $wangmaiProcessHelperWriteBlocked
    ; IfErrors consumes the flag. The writer returns an explicit status so an
    ; existing but locked file cannot mask an open or partial-write failure.
    ${If} $wangmaiProcessHelperWriteBlocked == "1"
    ${OrIfNot} ${FileExists} "$PLUGINSDIR\check-install-processes.ps1"
      DetailPrint "Could not write the PowerShell process helper (often blocked by security software); using the tasklist fallback."
      StrCpy $IsPowerShellAvailable 1
      StrCpy $wangmaiProcessHelperWriteBlocked "1"
    ${EndIf}
  ${EndIf}
  StrCpy $wangmaiProcessDiagnostic ""
  ${GetProcessInfo} 0 $pid $1 $2 $3 $4
  ${If} $3 != "${APP_EXECUTABLE_FILENAME}"
    ${If} ${isUpdated}
      Sleep 300
    ${EndIf}

    !insertmacro WangMaiFindInstallProcess "${APP_EXECUTABLE_FILENAME}" $R0
    ${If} $R0 == 0
      ${If} ${isUpdated}
        Sleep 1000
        Goto wangmai_stop_process
      ${EndIf}
      MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK wangmai_stop_process
      SetErrorLevel 22
      Quit

      wangmai_stop_process:
        DetailPrint "$(appClosing)"
        !insertmacro WangMaiKillInstallProcess "${APP_EXECUTABLE_FILENAME}" 0
        Sleep 300
        StrCpy $R1 0

      wangmai_process_retry:
        IntOp $R1 $R1 + 1
        !insertmacro WangMaiFindInstallProcess "${APP_EXECUTABLE_FILENAME}" $R0
        ${If} $R0 == 0
          Sleep 1000
          !insertmacro WangMaiKillInstallProcess "${APP_EXECUTABLE_FILENAME}" 1
          !insertmacro WangMaiFindInstallProcess "${APP_EXECUTABLE_FILENAME}" $R0
          ${If} $R0 == 0
            DetailPrint `Waiting for "${PRODUCT_NAME}" to close.`
            Sleep 2000
          ${Else}
            Goto wangmai_process_not_running
          ${EndIf}
        ${Else}
          Goto wangmai_process_not_running
        ${EndIf}

        ${If} $R1 > 1
          MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)$\r$\n$\r$\n$wangmaiProcessDiagnostic" /SD IDCANCEL IDRETRY wangmai_process_retry
          SetErrorLevel 22
          Quit
        ${Else}
          Goto wangmai_process_retry
        ${EndIf}

      wangmai_process_not_running:
    ${EndIf}
  ${EndIf}
  !ifndef BUILD_UNINSTALLER
    !insertmacro WangMaiRunLegacyRecovery
  !endif
!macroend

!ifndef BUILD_UNINSTALLER
!macro customPageAfterChangeDir
  Function WangMaiRecoveryBeforeInstall
    ${If} ${UAC_IsInnerInstance}
      !insertmacro WangMaiRunLegacyRecovery
    ${EndIf}
    Abort
  FunctionEnd
  Page custom WangMaiRecoveryBeforeInstall
!macroend

; Installed 0.6.x and older uninstallers still extract the process helper with
; `File`, so a security tool that blocks the .ps1 write makes them abort in
; un.onInit before touching any file (#1486). electron-builder would then quit
; and strand the user on the old version. Only when this installer saw the
; same block itself, install over the old files; exit code 22 (the old
; uninstaller found the app running) and every other failure stay fatal.
!macro WangMaiHandleOldUninstallerResult
  ${If} $R0 != 0
  ${AndIf} $R0 != 22
  ${AndIf} $wangmaiProcessHelperWriteBlocked == "1"
    DetailPrint `Old uninstaller exited with code $R0 and this installer could not write its helper script either (security software); installing over the existing files.`
  ${ElseIf} $R0 != 22
  ${AndIf} ${Errors}
    DetailPrint `Uninstall was not successful. Not able to launch uninstaller!`
  ${ElseIf} $R0 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "$(uninstallFailed): $R0" /SD IDOK
    DetailPrint `Uninstall was not successful. Uninstaller error code: $R0.`
    SetErrorLevel 2
    Quit
  ${EndIf}
!macroend

!macro customUnInstallCheck
  !insertmacro WangMaiHandleOldUninstallerResult
!macroend

!macro customUnInstallCheckCurrentUser
  !insertmacro WangMaiHandleOldUninstallerResult
!macroend

!macro customInit
  StrCpy $wangmaiRecoveryDone "0"
  ${If} ${UAC_IsInnerInstance}
  ${AndIf} ${Silent}
    !insertmacro WangMaiRunLegacyRecovery
  ${EndIf}
!macroend
!endif
