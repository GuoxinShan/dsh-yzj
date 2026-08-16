/**
 * model-yzj specs: default-route persistence (get/set/clear over a temp
 * store), malformed-file tolerance, and the llm-backed catalog passthrough
 * (empty without the service).
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { YzjModels } from '../src/index.ts'

function modelsWith(path: string): YzjModels {
  // The service only needs a context for logger/get; a bare Context works.
  const ctx = new Context()
  return new YzjModels(ctx, { path })
}

describe('YzjModels', () => {
  it('round-trips the default route through the store file', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'model-yzj-')), 'yzj-model.json')
    const models = modelsWith(path)
    expect(models.get()).toBeUndefined()
    await models.setDefault('deepseek', 'glm-4.7')
    expect(models.get()).toEqual({ provider: 'deepseek', model: 'glm-4.7' })
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ provider: 'deepseek', model: 'glm-4.7' })
  })

  it('clear() unsets and malformed files read as unset', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'model-yzj-')), 'yzj-model.json')
    const models = modelsWith(path)
    await models.setDefault('p', 'm')
    await models.clear()
    expect(models.get()).toBeUndefined()
    writeFileSync(path, 'not json {', 'utf8')
    expect(models.get()).toBeUndefined()
  })

  it('rejects half-empty routes', async () => {
    const models = modelsWith(join(mkdtempSync(join(tmpdir(), 'model-yzj-')), 'yzj-model.json'))
    await expect(models.setDefault('p', ' ')).rejects.toThrow(/non-empty/)
    await expect(models.setDefault('', 'm')).rejects.toThrow(/non-empty/)
  })

  it('catalog() is empty without the llm service and passes through with it', async () => {
    const bare = modelsWith(join(mkdtempSync(join(tmpdir(), 'model-yzj-')), 'yzj-model.json'))
    expect(await bare.catalog()).toEqual([])
    const ctx = new Context()
    ctx.provide('llm', {
      listProviders: () => [{ provider: 'deepseek' }],
      listConfigurableProviders: () => [{ provider: 'deepseek' }, { provider: 'pi' }],
      listModels: async (provider: string) => provider === 'deepseek'
        ? [{ id: 'glm-4.7' }, { model: 'glm-4.6' }]
        : Promise.reject(new Error('boom')),
    })
    const withLlm = new YzjModels(ctx, { path: join(mkdtempSync(join(tmpdir(), 'model-yzj-')), 'yzj-model.json') })
    expect(await withLlm.catalog()).toEqual([
      { provider: 'deepseek', models: ['glm-4.7', 'glm-4.6'] },
      { provider: 'pi', models: [] },
    ])
  })
})
