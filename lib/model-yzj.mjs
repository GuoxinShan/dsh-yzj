import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Service } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { randomBytes } from "node:crypto";
import { expandHomePath, resolveDshHome } from "@deepseek-ai/dsh-home-paths";
//#region packages/model-yzj/lib/index.js
/**
* model-yzj: the plugin-wide default model route for dsh-yzj packages.
* One editable default (provider + model) stored as plain JSON under
* `$DSH_HOME/yzj-model.json`, shared by every consumer in this bundle —
* robot channels fall back to it at the end of their resolution chain, and
* the memory dream executor prefers it over the harness default. The file is
* hand-editable and re-read on every access, so external edits apply live.
* @module @dsh-yzj/model-yzj
*/
/** Read a file as UTF-8 text, or undefined when it does not exist. */
function readText(path) {
	try {
		return readFileSync(path, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") return void 0;
		throw error;
	}
}
/** Write a file atomically (same volume): temp sibling + rename. */
function atomicWrite(path, content) {
	const tmp = `${path}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`;
	writeFileSync(tmp, content, "utf8");
	renameSync(tmp, path);
}
const Config = z.object({ path: z.string() });
/** The plugin-wide default-model service. */
var YzjModels = class extends Service {
	filePath;
	constructor(ctx, config) {
		super(ctx, "yzjModels");
		this.filePath = config.path !== void 0 && config.path !== "" ? expandHomePath(config.path) : join(resolveDshHome(), "yzj-model.json");
	}
	/** Store path (diagnostics / UI display). */
	get path() {
		return this.filePath;
	}
	/** The current default route, or undefined when unset or malformed. */
	get() {
		const raw = readText(this.filePath);
		if (raw === void 0) return void 0;
		try {
			const parsed = JSON.parse(raw);
			if (typeof parsed !== "object" || parsed === null) return void 0;
			const provider = parsed.provider;
			const model = parsed.model;
			if (typeof provider !== "string" || typeof model !== "string") return void 0;
			if (provider.trim() === "" || model.trim() === "") return void 0;
			return {
				provider: provider.trim(),
				model: model.trim()
			};
		} catch {
			return;
		}
	}
	/** Persist the default route (both fields required, trimmed). */
	async setDefault(provider, model) {
		const cleanProvider = provider.trim();
		const cleanModel = model.trim();
		if (cleanProvider === "" || cleanModel === "") throw new Error("model-yzj: setDefault requires non-empty provider and model");
		atomicWrite(this.filePath, `${JSON.stringify({
			provider: cleanProvider,
			model: cleanModel
		}, null, 2)}\n`);
		return {
			provider: cleanProvider,
			model: cleanModel
		};
	}
	/** Remove the default (consumers fall back to the harness default). */
	async clear() {
		atomicWrite(this.filePath, "{\n  \"provider\": \"\",\n  \"model\": \"\"\n}\n");
	}
	/**
	* Provider/model catalog for UI pickers: active adapter routes only
	* (`listProviders`), dormant-but-configurable providers excluded — the
	* same policy the robot settings picker applies. Reads the `llm` service
	* opportunistically; an absent service yields an empty catalog.
	*/
	async catalog() {
		const llm = this.ctx.get("llm");
		if (llm === void 0) return [];
		const face = llm;
		const names = [...(face.listProviders?.() ?? []).map((entry) => String(entry.provider ?? "")), ...(face.listConfigurableProviders?.() ?? []).map((entry) => String(entry.provider ?? ""))].filter((name) => name !== "");
		const out = [];
		for (const provider of [...new Set(names)]) try {
			const models = await face.listModels?.(provider) ?? [];
			out.push({
				provider,
				models: models.map((m) => String(m.id ?? m.model ?? "")).filter((id) => id !== "")
			});
		} catch (error) {
			this.ctx.logger.warn(`model-yzj: listModels failed for ${provider}: ${String(error)}`);
			out.push({
				provider,
				models: []
			});
		}
		return out;
	}
};
/** Cordis plugin name used by loader diagnostics. */
const name = "model-yzj";
/** No hard dependencies: `llm` is read opportunistically for the catalog. */
const inject = [];
/** Plugin entry: the service alone. */
function apply(ctx, config) {
	new YzjModels(ctx, config);
}
//#endregion
export { Config, YzjModels, apply, inject, name };
