import { spawn } from 'node:child_process'

interface TerminalCandidate {
  label: string
  executable: string
  args: (cwd: string) => string[]
}

const MAC_TERMINAL_CANDIDATES: TerminalCandidate[] = [
  { label: 'Terminal', executable: '/usr/bin/open', args: cwd => ['-a', 'Terminal', cwd] },
  { label: 'iTerm', executable: '/usr/bin/open', args: cwd => ['-a', 'iTerm', cwd] },
  { label: 'Warp', executable: '/usr/bin/open', args: cwd => ['-a', 'Warp', cwd] },
]

const WINDOWS_TERMINAL_CANDIDATES: TerminalCandidate[] = [
  { label: 'Windows Terminal', executable: 'wt.exe', args: cwd => ['-d', cwd] },
  { label: 'PowerShell', executable: 'cmd.exe', args: () => ['/d', '/s', '/c', 'start "" powershell.exe -NoExit -NoLogo'] },
  { label: 'Command Prompt', executable: 'cmd.exe', args: () => ['/d', '/s', '/c', 'start "" cmd.exe /K'] },
]

const LINUX_TERMINAL_CANDIDATES: TerminalCandidate[] = [
  { label: 'x-terminal-emulator', executable: 'x-terminal-emulator', args: () => [] },
  { label: 'GNOME Terminal', executable: 'gnome-terminal', args: cwd => [`--working-directory=${cwd}`] },
  { label: 'Konsole', executable: 'konsole', args: cwd => ['--workdir', cwd] },
  { label: 'XFCE Terminal', executable: 'xfce4-terminal', args: cwd => [`--working-directory=${cwd}`] },
  { label: 'Kitty', executable: 'kitty', args: cwd => ['--directory', cwd] },
  { label: 'Alacritty', executable: 'alacritty', args: cwd => ['--working-directory', cwd] },
  { label: 'WezTerm', executable: 'wezterm', args: cwd => ['start', '--cwd', cwd] },
  { label: 'XTerm', executable: 'xterm', args: () => [] },
]

export function readTerminalLaunchCandidates(platform: NodeJS.Platform = process.platform): readonly TerminalCandidate[] {
  if (platform === 'darwin') {
    return MAC_TERMINAL_CANDIDATES
  }
  if (platform === 'win32') {
    return WINDOWS_TERMINAL_CANDIDATES
  }
  return LINUX_TERMINAL_CANDIDATES
}

/**
 * Build a launch candidate from a user-supplied terminal app name.
 *
 * There is no stable system API for "the user's default terminal", so we let the
 * user name one directly. The name is wrapped per platform rather than treated
 * as a raw shell command, keeping the input predictable:
 *   - macOS: `open -a "<app>" <cwd>` (e.g. `Ghostty.app`, `iTerm.app`)
 *   - Windows: `<app> -d <cwd>` (e.g. `wt.exe`)
 *   - Linux: `<app> --working-directory=<cwd>` (e.g. `gnome-terminal`)
 */
export function buildAppTerminalCandidate(appName: string, platform: NodeJS.Platform = process.platform): TerminalCandidate {
  if (platform === 'darwin') {
    return { label: appName, executable: '/usr/bin/open', args: cwd => ['-a', appName, cwd] }
  }
  if (platform === 'win32') {
    return { label: appName, executable: appName, args: cwd => ['-d', cwd] }
  }
  return { label: appName, executable: appName, args: cwd => [`--working-directory=${cwd}`] }
}

function runTerminalCandidate(candidate: TerminalCandidate, cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(candidate.executable, candidate.args(cwd), {
      cwd,
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    })

    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

/**
 * Open `cwd` in an external terminal.
 *
 * When `appName` is provided, that exact terminal is launched with no fallback —
 * the user has been explicit, so silently substituting another terminal would be
 * surprising. When omitted, the platform's default preferred terminal is used
 * (the first candidate), again with no fallback.
 */
export async function launchPathInTerminal(cwd: string, appName?: string | null): Promise<string> {
  const trimmed = (appName ?? '').trim()
  const candidate = trimmed
    ? buildAppTerminalCandidate(trimmed)
    : readTerminalLaunchCandidates()[0]

  if (!candidate) {
    throw new Error(`No supported terminal could open ${cwd}.`)
  }

  try {
    await runTerminalCandidate(candidate, cwd)
    return candidate.label
  }
  catch (error) {
    throw new Error(
      `Could not open ${cwd} in ${candidate.label}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
