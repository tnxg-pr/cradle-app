import {
  ClockwiseLine as RestartIcon,
  DeleteLine as TrashIcon,
  LinkLine as LinkIcon,
  PencilLine as PencilIcon,
  PlusLine as PlusIcon,
} from '@mingcute/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  getRelayServersOptions,
  getRelayServersQueryKey,
} from '~/api-gen/@tanstack/react-query.gen'
import {
  deleteRelayServersByRelayServerId,
  patchRelayServersByRelayServerId,
  postRelayServers,
} from '~/api-gen/sdk.gen'
import type {
  GetRelayServersResponse,
  PatchRelayServersByRelayServerIdData,
  PostRelayServersData,
} from '~/api-gen/types.gen'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Spinner } from '~/components/ui/spinner'
import { Switch } from '~/components/ui/switch'
import { toastManager } from '~/components/ui/toast'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'

import { SettingsGroup } from './settings-container'
import { SettingsRow } from './settings-row'
import type { NetworkInboundAccessMode, NetworkInboundPreferences } from './use-network-preferences'
import { useNetworkPreferencesQuery, useUpdateNetworkPreferencesMutation } from './use-network-preferences'

type RelayServer = GetRelayServersResponse[number]
type RelayServerSaveBody = PostRelayServersData['body']
type RelayServerUpdateBody = PatchRelayServersByRelayServerIdData['body']
type SettingsKey = keyof typeof import('~/locales/default').default.settings

const MANAGED_LOCAL_RELAY_SERVER_ID = 'system:local-relayd'
const MANAGED_LOCAL_RELAY_ACCESS_OPTIONS: Array<{ value: NetworkInboundAccessMode, labelKey: SettingsKey }> = [
  { value: 'local', labelKey: 'network.inbound.access.local' },
  { value: 'network', labelKey: 'network.inbound.access.network' },
]

interface RelayServerFormValues {
  displayName: string
  relayUrl: string
  enabled: boolean
  isDefault: boolean
}

function describeError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.length > 0) {
      return message
    }
  }
  if (typeof error === 'string') {
    return error
  }
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

function normalizeRelayPublicUrl(value: string): string | null {
  const raw = value.trim()
  if (!raw) {
    return null
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`
  try {
    const url = new URL(withScheme)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || !url.port) {
      return null
    }
    url.pathname = url.pathname.replace(/\/+$/, '')
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  }
  catch {
    return null
  }
}

function initialRelayServerFormValues(server?: RelayServer): RelayServerFormValues {
  return {
    displayName: server?.displayName ?? '',
    relayUrl: server?.relayUrl ?? '',
    enabled: server?.enabled ?? true,
    isDefault: server?.isDefault ?? false,
  }
}

function buildRelayServerSaveBody(values: RelayServerFormValues): RelayServerSaveBody {
  return {
    displayName: values.displayName.trim(),
    relayUrl: values.relayUrl.trim(),
    enabled: values.enabled,
    isDefault: values.isDefault,
  }
}

function buildRelayServerUpdateBody(values: RelayServerFormValues): RelayServerUpdateBody {
  return buildRelayServerSaveBody(values)
}

function isManagedLocalRelayServer(server: RelayServer): boolean {
  return server.id === MANAGED_LOCAL_RELAY_SERVER_ID
}

function ManagedLocalRelayControls() {
  const { t } = useTranslation('settings')
  const { data: prefs, isLoading } = useNetworkPreferencesQuery()
  const updatePreferences = useUpdateNetworkPreferencesMutation()
  const [relayUrlDraft, setRelayUrlDraft] = useState('')
  const [relayUrlError, setRelayUrlError] = useState<string | null>(null)

  useEffect(() => {
    setRelayUrlDraft(prefs?.inbound.managedRelayPublicUrl ?? '')
    setRelayUrlError(null)
  }, [prefs?.inbound.managedRelayPublicUrl])

  const saveInboundPreference = (updates: Partial<NetworkInboundPreferences>) => {
    if (!prefs) {
      return
    }
    updatePreferences.mutate({ inbound: { ...prefs.inbound, ...updates } })
  }

  const saveRelayUrlDraft = () => {
    if (!prefs) {
      return
    }
    const trimmed = relayUrlDraft.trim()
    if (!trimmed) {
      setRelayUrlError(null)
      updatePreferences.mutate({ inbound: { ...prefs.inbound, managedRelayPublicUrl: null } })
      return
    }
    const normalized = normalizeRelayPublicUrl(trimmed)
    if (!normalized) {
      setRelayUrlError(t('network.inbound.relay.publicUrl.error' as SettingsKey))
      return
    }
    setRelayUrlError(null)
    setRelayUrlDraft(normalized)
    updatePreferences.mutate({ inbound: { ...prefs.inbound, managedRelayPublicUrl: normalized } })
  }

  const disabled = isLoading || !prefs || updatePreferences.isPending
  const accessMode = prefs?.inbound.managedRelayAccessMode ?? 'local'

  return (
    <div className="-mx-3.5 -mb-3 mt-3 border-t border-border/60">
      <SettingsRow
        label={t('network.inbound.relay.label' as SettingsKey)}
        description={t('network.inbound.relay.description' as SettingsKey)}
        className="px-3.5"
      >
        <Select
          value={accessMode}
          onValueChange={value => saveInboundPreference({ managedRelayAccessMode: value as NetworkInboundAccessMode })}
          disabled={disabled}
        >
          <SelectTrigger size="sm" className="w-[180px]" aria-label={t('network.inbound.relay.label' as SettingsKey)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MANAGED_LOCAL_RELAY_ACCESS_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRow>

      {accessMode === 'network' && (
        <SettingsRow
          label={t('network.inbound.relay.publicUrl.label' as SettingsKey)}
          description={relayUrlError ?? t('network.inbound.relay.publicUrl.description' as SettingsKey)}
          vertical
          className="border-t border-border/60 px-3.5"
        >
          <Input
            value={relayUrlDraft}
            onChange={(event) => {
              setRelayUrlDraft(event.target.value)
              setRelayUrlError(null)
            }}
            onBlur={saveRelayUrlDraft}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur()
              }
            }}
            disabled={disabled}
            placeholder={t('network.inbound.relay.publicUrl.placeholder' as SettingsKey)}
            aria-invalid={relayUrlError ? true : undefined}
            aria-label={t('network.inbound.relay.publicUrl.label' as SettingsKey)}
            className="h-8 font-mono text-xs"
          />
        </SettingsRow>
      )}

      <SettingsRow
        label={t('network.inbound.apply.label' as SettingsKey)}
        description={t('network.inbound.apply.description' as SettingsKey)}
        className="border-t border-border/60 px-3.5"
      >
        <Badge variant="outline" className="gap-1.5 text-[11px]">
          <RestartIcon className="size-3" aria-hidden="true" />
          {t('network.inbound.apply.badge' as SettingsKey)}
        </Badge>
      </SettingsRow>
    </div>
  )
}

function RelayServerFormDialog({ open, onOpenChange, server }: { open: boolean, onOpenChange: (open: boolean) => void, server?: RelayServer }) {
  const { t } = useTranslation('settings')
  const queryClient = useQueryClient()
  const [values, setValues] = useState<RelayServerFormValues>(() => initialRelayServerFormValues(server))
  const set = (patch: Partial<RelayServerFormValues>) => setValues(prev => ({ ...prev, ...patch }))
  const valid = values.displayName.trim().length > 0 && values.relayUrl.trim().length > 0

  const save = useMutation({
    mutationFn: async () => {
      if (server) {
        const { error } = await patchRelayServersByRelayServerId({
          path: { relayServerId: server.id },
          body: buildRelayServerUpdateBody(values),
        })
        if (error) {
          throw error
        }
        return
      }
      const { error } = await postRelayServers({ body: buildRelayServerSaveBody(values) })
      if (error) {
        throw error
      }
    },
    onSuccess: () => {
      toastManager.add({ type: 'success', title: t(server ? 'remoteHosts.relayServers.toast.updated' : 'remoteHosts.relayServers.toast.created') })
      void queryClient.invalidateQueries({ queryKey: getRelayServersQueryKey() })
      onOpenChange(false)
    },
    onError: error => toastManager.add({
      type: 'error',
      title: t('remoteHosts.relayServers.toast.saveFailed'),
      description: describeError(error),
    }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(server ? 'remoteHosts.relayServers.form.editTitle' : 'remoteHosts.relayServers.form.addTitle')}</DialogTitle>
          <DialogDescription>{t('remoteHosts.relayServers.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="relay-server-display-name" className="text-xs">{t('remoteHosts.relayServers.form.displayName')}</Label>
            <Input
              id="relay-server-display-name"
              value={values.displayName}
              onChange={event => set({ displayName: event.target.value })}
              placeholder={t('remoteHosts.relayServers.form.displayNamePlaceholder')}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="relay-server-url" className="text-xs">{t('remoteHosts.relayServers.form.relayUrl')}</Label>
            <Input
              id="relay-server-url"
              value={values.relayUrl}
              onChange={event => set({ relayUrl: event.target.value })}
              placeholder={t('remoteHosts.relayServers.form.relayUrlPlaceholder')}
              className="h-8 font-mono text-xs"
            />
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 px-3 py-2.5">
            <div className="flex items-center justify-between gap-4">
              <Label className="text-xs">{t('remoteHosts.form.enabled')}</Label>
              <Switch checked={values.enabled} onCheckedChange={enabled => set({ enabled })} size="sm" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label className="text-xs">{t('remoteHosts.relayServers.form.isDefault')}</Label>
              <Switch checked={values.isDefault} onCheckedChange={isDefault => set({ isDefault })} size="sm" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-7 text-xs">
            {t('remoteHosts.action.cancel')}
          </Button>
          <Button size="sm" disabled={!valid || save.isPending} onClick={() => save.mutate()} className="h-7 text-xs">
            {save.isPending && <Spinner className="size-3.5" />}
            {t(server ? 'remoteHosts.action.save' : 'remoteHosts.action.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RelayServerRow({ server }: { server: RelayServer }) {
  const { t } = useTranslation('settings')
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const isManagedLocal = isManagedLocalRelayServer(server)
  const displayName = isManagedLocal ? t('remoteHosts.relayServers.managedLocalName') : server.displayName

  const invalidateRelayServers = () => {
    void queryClient.invalidateQueries({ queryKey: getRelayServersQueryKey() })
  }

  const updateServer = useMutation({
    mutationFn: async (body: RelayServerUpdateBody) => {
      const { error } = await patchRelayServersByRelayServerId({
        path: { relayServerId: server.id },
        body,
      })
      if (error) {
        throw error
      }
    },
    onSuccess: () => {
      toastManager.add({ type: 'success', title: t('remoteHosts.relayServers.toast.updated') })
      invalidateRelayServers()
    },
    onError: error => toastManager.add({
      type: 'error',
      title: t('remoteHosts.relayServers.toast.saveFailed'),
      description: describeError(error),
    }),
  })

  const deleteServer = useMutation({
    mutationFn: async () => {
      const { error } = await deleteRelayServersByRelayServerId({ path: { relayServerId: server.id } })
      if (error) {
        throw error
      }
    },
    onSuccess: () => {
      toastManager.add({ type: 'success', title: t('remoteHosts.relayServers.toast.deleted') })
      invalidateRelayServers()
      setConfirmingDelete(false)
    },
    onError: error => toastManager.add({
      type: 'error',
      title: t('remoteHosts.relayServers.toast.deleteFailed'),
      description: describeError(error),
    }),
  })

  const busy = updateServer.isPending || deleteServer.isPending

  const headerRow = (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
        <LinkIcon className="size-3.5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[12.5px] font-medium text-foreground">{displayName}</span>
          {isManagedLocal && (
            <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-normal text-muted-foreground">
              {t('remoteHosts.relayServers.badge.managed')}
            </Badge>
          )}
          {server.isDefault && (
            <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-normal text-emerald-600 dark:text-emerald-400">
              {t('remoteHosts.relayServers.badge.default')}
            </Badge>
          )}
          {!server.enabled && (
            <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-normal text-muted-foreground">
              {t('remoteHosts.badge.disabled')}
            </Badge>
          )}
        </div>
        <div className="truncate font-mono text-[11px] text-muted-foreground/70">{server.relayUrl}</div>
        {isManagedLocal && (
          <div className="text-[11px] leading-relaxed text-muted-foreground">
            {t('remoteHosts.relayServers.managedLocalDescription')}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Switch
          checked={server.enabled}
          onCheckedChange={enabled => updateServer.mutate({ enabled })}
          disabled={busy || isManagedLocal}
          size="sm"
          aria-label={t('remoteHosts.form.enabled')}
        />

        {!server.isDefault && (
          <Button
            size="xs"
            variant="ghost"
            className="h-7 px-2.5 text-[11px]"
            disabled={busy || !server.enabled}
            onClick={() => updateServer.mutate({ isDefault: true })}
          >
            {t('remoteHosts.relayServers.action.setDefault')}
          </Button>
        )}

        {!isManagedLocal && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon-xs" variant="ghost" disabled={busy} onClick={() => setEditing(true)} aria-label={t('remoteHosts.relayServers.action.edit')}>
                  <PencilIcon className="size-3.5" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('remoteHosts.relayServers.action.edit')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirmingDelete(true)}
                  aria-label={t('remoteHosts.relayServers.action.delete')}
                >
                  {deleteServer.isPending ? <Spinner className="size-3.5" /> : <TrashIcon className="size-3.5" aria-hidden="true" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('remoteHosts.relayServers.action.delete')}</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  )

  if (isManagedLocal) {
    return (
      <div className="px-3.5 py-3">
        {headerRow}
        <ManagedLocalRelayControls />
      </div>
    )
  }

  return (
    <div className="px-3.5 py-3">
      {headerRow}
      {editing && <RelayServerFormDialog server={server} open onOpenChange={open => !open && setEditing(false)} />}

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('remoteHosts.relayServers.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('remoteHosts.relayServers.delete.description', { name: displayName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('remoteHosts.action.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleteServer.mutate()}>
              {t('remoteHosts.relayServers.action.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function RelayServersSection() {
  const { t } = useTranslation('settings')
  const [creating, setCreating] = useState(false)
  const { data: relayServers = [], isLoading } = useQuery(getRelayServersOptions())

  return (
    <SettingsGroup
      label={t('remoteHosts.relayServers.title')}
      description={t('remoteHosts.relayServers.description')}
      action={(
        <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
          <PlusIcon className="size-3.5" aria-hidden="true" />
          {t('remoteHosts.relayServers.add')}
        </Button>
      )}
      bare
      className="[&>*+*]:border-t [&>*+*]:border-border/60"
    >
      {isLoading
        ? (
            <div className="flex items-center justify-center gap-2 px-3.5 py-6 text-[12px] text-muted-foreground">
              <Spinner className="size-3.5" />
              {t('remoteHosts.loading')}
            </div>
          )
        : relayServers.length === 0
          ? (
              <div className="px-3.5 py-5 text-[12px] text-muted-foreground">
                {t('remoteHosts.relayServers.empty')}
              </div>
            )
          : relayServers.map(server => <RelayServerRow key={server.id} server={server} />)}

      {creating && <RelayServerFormDialog open onOpenChange={open => !open && setCreating(false)} />}
    </SettingsGroup>
  )
}
