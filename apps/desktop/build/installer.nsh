; Custom NSIS installer script for Cradle
; Uses nsProcess plugin (bundled with electron-builder) to kill残留进程
; before installation begins, preventing the "cannot be closed" hang.

!macro customInit
  ; Force-kill any running Cradle instance at installer startup
  nsProcess::_KillProcess "Cradle.exe" $R0
  ; Give the OS a moment to fully release file locks
  Sleep 1000
!macroend
