import { z } from 'zod'

export class PluginLoadError extends Error {
  constructor(
    public readonly pluginName: string,
    message: string,
  ) {
    super(`[plugin:${pluginName}] ${message}`)
    this.name = 'PluginLoadError'
  }
}

const PluginFunctionSchema = z.function({
  input: [z.unknown()],
  output: z.unknown(),
})

const PluginModuleSchema = z.object({
  activate: PluginFunctionSchema,
  deactivate: PluginFunctionSchema.optional(),
}).passthrough()

export function validatePluginModule(
  mod: unknown,
  pluginName: string,
  layer: 'server' | 'desktop' | 'web',
): asserts mod is z.infer<typeof PluginModuleSchema> {
  try {
    PluginModuleSchema.parse(mod)
  }
  catch (err) {
    throw new PluginLoadError(pluginName, `${layer} entry is not a valid plugin module: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export function validateMarketplacePackageIntegrity(input: {
  pluginName: string
  expectedChecksum: string
  actualChecksum: string
}): void {
  if (input.expectedChecksum !== input.actualChecksum) {
    throw new PluginLoadError(
      input.pluginName,
      `marketplace package checksum mismatch: expected ${input.expectedChecksum}, got ${input.actualChecksum}`,
    )
  }
}
