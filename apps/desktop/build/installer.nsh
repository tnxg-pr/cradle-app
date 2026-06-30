; Custom NSIS installer script for Cradle
; Works around electron-builder#6865: the "cannot be closed" error message is
; misleading — it is also shown when file operations fail (locked files, long
; paths, uninstaller failures), not just when the app process is still running.
;
; See: https://github.com/electron-userland/electron-builder/issues/6865
; See: https://github.com/electron-userland/electron-builder/issues/6409
; See: https://github.com/electron-userland/electron-builder/pull/9784

; --- Early init: kill process + delete old uninstaller ---

!macro customInit
  ; Force-kill any running Cradle instance before anything else
  nsProcess::_KillProcess "${APP_EXECUTABLE_FILENAME}" $R0
  Sleep 1000
  ; Delete old uninstaller to prevent the installer from trying to run it
  ; during update (which can fail and show the misleading "cannot be closed")
  Delete "$INSTDIR\Uninstall*.exe"
!macroend

; --- Override process detection during install ---
; Give the app more time to exit gracefully and use more retries before
; showing the "cannot be closed" dialog.

!include "getProcessInfo.nsh"
Var pid

!macro customCheckAppRunning
  SetDetailsPrint textonly

  ${GetProcessInfo} 0 $pid $1 $2 $3 $4

  ${if} $3 != "${APP_EXECUTABLE_FILENAME}"
    ${if} ${isUpdated}
      DetailPrint `Waiting for "${PRODUCT_NAME}" to exit gracefully...`
      Sleep 3000
    ${endIf}

    ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
    ${if} $R0 == 0
      DetailPrint `"${PRODUCT_NAME}" is still running, attempting to close...`

      nsExec::Exec `taskkill /IM "${APP_EXECUTABLE_FILENAME}" /fi "PID ne $pid"`
      Sleep 2000

      StrCpy $R1 0
      StrCpy $R2 5

      loop:
        IntOp $R1 $R1 + 1

        ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
        ${if} $R0 == 0
          DetailPrint `Attempt $R1/$R2: force-killing "${PRODUCT_NAME}"...`
          nsExec::Exec `taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /fi "PID ne $pid"`
          Sleep 2000

          ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
          ${if} $R0 == 0
            ${if} $R1 >= $R2
              DetailPrint `Unable to close "${PRODUCT_NAME}" automatically.`
              MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY loop
              Quit
            ${endIf}
            Goto loop
          ${else}
            Goto not_running
          ${endIf}
        ${else}
          Goto not_running
        ${endIf}

      not_running:
        DetailPrint `"${PRODUCT_NAME}" has been closed.`
    ${else}
      DetailPrint `"${PRODUCT_NAME}" is not running.`
    ${endIf}
  ${endIf}

  SetDetailsPrint none
!macroend

; --- Override file removal during uninstall/update ---
; Bypass un.atomicRMDir which fails on long paths or locked files and then
; shows the misleading "cannot be closed" error.

!macro customRemoveFiles
  DetailPrint "Removing files..."
  RMDir /r "$INSTDIR"
!macroend
