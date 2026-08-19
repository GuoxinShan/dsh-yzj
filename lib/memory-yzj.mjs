import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Service } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { SessionId } from "@deepseek-ai/dsh-session";
import { createHash, randomBytes } from "node:crypto";
import { expandHomePath, resolveDshHome } from "@deepseek-ai/dsh-home-paths";
//#region packages/memory-yzj/lib/index.js
/**
* Minimal note-file primitives for the memory vault: tolerant frontmatter
* parsing/serialization, content revisions (short hashes), atomic writes,
* and file-name validation. Notes are plain `--- fenced ---` Markdown with
* string or string-list frontmatter values — the same shape the reference
* dream-vault export uses, so human edits in any editor stay first-class.
* @module @dsh-yzj/memory-yzj/frontmatter
*/
/** Match one `key: value` frontmatter entry line. */
const ENTRY = /^([A-Za-z0-9_]+):\s*(.*)$/;
/** Match one indented `- item` list continuation line. */
const LIST_ITEM = /^\s+-\s+(.*)$/;
/** Characters a vault file name must never contain (Windows + POSIX hazards). */
const UNSAFE_NAME = /[/\\:*?"<>|\u0000-\u001f]/;
/** Strip one pair of matching surrounding quotes, if present. */
function unquote(value) {
	if (value.length >= 2) {
		const first = value[0];
		const last = value[value.length - 1];
		if (first === "'" && last === "'" || first === "\"" && last === "\"") return value.slice(1, -1);
	}
	return value;
}
/** Read one scalar frontmatter value as a string; undefined for lists/absence. */
function fmString(frontmatter, key) {
	const value = frontmatter[key];
	return typeof value === "string" ? value : void 0;
}
/** Read one frontmatter value as a string list; scalars become singletons. */
function fmList(frontmatter, key) {
	const value = frontmatter[key];
	if (Array.isArray(value)) return value;
	if (typeof value === "string" && value !== "") return [value];
	return [];
}
/** Read one scalar as a finite number; undefined for absence or non-numbers. */
function fmNumber(frontmatter, key) {
	const raw = fmString(frontmatter, key);
	if (raw === void 0 || raw.trim() === "") return void 0;
	const parsed = Number(raw);
	return Number.isFinite(parsed) ? parsed : void 0;
}
/** Read one scalar as a boolean; only the literal `true`/`false` count. */
function fmBool(frontmatter, key) {
	const raw = fmString(frontmatter, key);
	if (raw === void 0) return void 0;
	if (raw.trim() === "true") return true;
	if (raw.trim() === "false") return false;
}
/**
* Parse a note file: an optional leading `---` fence of `key: value` entries
* (with `  - item` list continuations), then the body. Tolerant by design —
* human-edited files with odd quoting or unknown shapes still parse, with the
* odd lines kept verbatim as scalars.
*/
function parseNote(raw) {
	const lines = raw.split("\n");
	if (lines[0]?.trim() !== "---") return {
		frontmatter: {},
		body: raw.trim()
	};
	let end = -1;
	for (let i = 1; i < lines.length; i++) if (lines[i]?.trim() === "---") {
		end = i;
		break;
	}
	if (end < 0) return {
		frontmatter: {},
		body: raw.trim()
	};
	const frontmatter = {};
	let currentListKey;
	for (let i = 1; i < end; i++) {
		const line = lines[i] ?? "";
		const listMatch = LIST_ITEM.exec(line);
		if (listMatch !== null && currentListKey !== void 0) {
			const existing = frontmatter[currentListKey];
			const item = unquote(listMatch[1] ?? "").trim();
			if (Array.isArray(existing)) existing.push(item);
			else frontmatter[currentListKey] = [item];
			continue;
		}
		const entry = ENTRY.exec(line);
		if (entry === null) continue;
		const key = entry[1] ?? "";
		const rest = (entry[2] ?? "").trim();
		if (rest === "") {
			frontmatter[key] = [];
			currentListKey = key;
		} else {
			frontmatter[key] = unquote(rest);
			currentListKey = void 0;
		}
	}
	for (const key of Object.keys(frontmatter)) {
		const value = frontmatter[key];
		if (Array.isArray(value) && value.length === 0) delete frontmatter[key];
	}
	return {
		frontmatter,
		body: lines.slice(end + 1).join("\n").trim()
	};
}
/** Render one frontmatter value block (`key: v` or `key:` + indented items). */
function renderEntry(key, value) {
	if (typeof value === "string") return `${key}: ${value === "" ? "''" : value}`;
	if (value.length === 0) return `${key}: []`;
	return `${key}:\n${value.map((item) => `  - ${item.includes(":") ? `'${item}'` : item}`).join("\n")}`;
}
/** Serialize a note back to its file form (exactly one trailing newline). */
function serializeNote(frontmatter, body) {
	const entries = Object.entries(frontmatter).map(([key, value]) => renderEntry(key, value));
	return `${entries.length === 0 ? "" : `---\n${entries.join("\n")}\n---\n\n`}${body.trim()}\n`;
}
/** Short content revision: first 16 hex chars of the SHA-256 digest. */
function revOf(content) {
	return createHash("sha256").update(content, "utf8").digest("hex").slice(0, 16);
}
/**
* Write a file atomically (same volume): write to a unique temp sibling, then
* rename over the target. A crash mid-write never leaves a torn note.
*/
function atomicWrite(path, content) {
	const tmp = `${path}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`;
	writeFileSync(tmp, content, "utf8");
	renameSync(tmp, path);
}
/** Read a file as UTF-8 text, or undefined when it does not exist. */
function readText(path) {
	try {
		return readFileSync(path, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") return void 0;
		throw error;
	}
}
/**
* Validate one vault file name segment (section or entity name). Allows
* letters, digits, underscore, hyphen, and CJK; rejects Windows-hazard
* characters, control characters, leading dots, and overlong names.
* @returns the validated name.
* @throws a descriptive error the caller can surface per decision item.
*/
function safeName(kind, name) {
	const trimmed = name.trim();
	if (trimmed === "") throw new Error(`${kind} name must not be empty`);
	if (trimmed.startsWith(".") || UNSAFE_NAME.test(trimmed)) throw new Error(`${kind} name ${JSON.stringify(trimmed)} contains characters not allowed in file names`);
	if (trimmed.length > 80) throw new Error(`${kind} name exceeds 80 characters`);
	return trimmed;
}
/** Format one local timestamp as a compact `yyyymmddHHMMss` id fragment. */
function timestampId(now = /* @__PURE__ */ new Date()) {
	const pad = (n, width = 2) => String(n).padStart(width, "0");
	return `${pad(now.getFullYear(), 4)}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}
/** Format one local date as `YYYY-MM-DD` (frontmatter `created` fields). */
function dateStr(now = /* @__PURE__ */ new Date()) {
	const pad = (n, width = 2) => String(n).padStart(width, "0");
	return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
/**
* Per-scope memory vault file model: sections (curated long-term memory),
* entities (structured pages), observations (provisional scratchpad), plus
* the generated index and the append-only dream log. Everything is plain
* Markdown over synchronous fs — the payloads are small and bounded by
* design, and sync access makes every operation atomic within one process
* (no interleaved read-modify-write windows to guard).
* @module @dsh-yzj/memory-yzj/vault
*/
/** Default injection character cap when `sections.yaml` is absent. */
const DEFAULT_INJECT_CHAR_CAP = 6e3;
/** Parse `inject_char_cap: <int>` from a scope's flat config file. */
function readCap(path, fallback) {
	const raw = readText(path);
	if (raw === void 0) return fallback;
	for (const line of raw.split("\n")) {
		const match = /^(?:#\s*)?inject_char_cap:\s*(\d+)\s*$/.exec(line);
		if (match !== null) return Number.parseInt(match[1] ?? "", 10);
	}
	return fallback;
}
/** List `*.md` files of one directory sorted by name; missing dir is empty. */
function listMarkdown(dir) {
	if (!existsSync(dir)) return [];
	return readdirSync(dir).filter((name) => name.endsWith(".md")).sort();
}
/** One scope's vault, rooted at its own directory. */
var MemoryVault = class {
	dir;
	observationsMax;
	injectCharCapFallback;
	/** Section names are re-validated on every write path. */
	constructor(dir, observationsMax, injectCharCapFallback = DEFAULT_INJECT_CHAR_CAP) {
		this.dir = dir;
		this.observationsMax = observationsMax;
		this.injectCharCapFallback = injectCharCapFallback;
	}
	/** Create the scope skeleton when absent; idempotent. */
	ensure() {
		mkdirSync(join(this.dir, "sections"), { recursive: true });
		mkdirSync(join(this.dir, "entities"), { recursive: true });
		mkdirSync(join(this.dir, "observations", "archived"), { recursive: true });
		if (readText(this.sectionsYamlPath()) === void 0) atomicWrite(this.sectionsYamlPath(), `inject_char_cap: ${this.injectCharCapFallback}\n`);
		if (readText(this.logPath()) === void 0) atomicWrite(this.logPath(), "# Dream Log\n");
	}
	/** `sections.yaml` path (flat per-scope config). */
	sectionsYamlPath() {
		return join(this.dir, "sections.yaml");
	}
	/** Dream log path. */
	logPath() {
		return join(this.dir, "log.md");
	}
	/** Generated index path. */
	indexPath() {
		return join(this.dir, "index.md");
	}
	/** Injection character cap in force for this scope. */
	cap() {
		return readCap(this.sectionsYamlPath(), this.injectCharCapFallback);
	}
	sectionPath(name) {
		return join(this.dir, "sections", `${name}.md`);
	}
	/** All sections ordered for injection (order asc, then name). */
	listSections() {
		return listMarkdown(join(this.dir, "sections")).map((file) => this.readSection(file.slice(0, -3))).filter((entry) => entry !== void 0).sort((a, b) => a.order - b.order || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
	}
	/** Read one section; undefined when absent or unreadable. */
	readSection(name) {
		const raw = readText(this.sectionPath(name));
		if (raw === void 0) return void 0;
		const note = parseNote(raw);
		return {
			name,
			title: fmString(note.frontmatter, "title") ?? name,
			order: fmNumber(note.frontmatter, "order") ?? 100,
			tags: fmList(note.frontmatter, "tags"),
			created: fmString(note.frontmatter, "created") ?? "",
			lastUpdated: fmString(note.frontmatter, "last_updated") ?? "",
			content: note.body,
			rev: revOf(raw)
		};
	}
	/** Create or replace one section; returns the written revision. */
	writeSection(name, write) {
		const safe = safeName("section", name);
		const existing = this.readSection(safe);
		const today = dateStr();
		const raw = serializeNote({
			title: write.title,
			order: String(write.order),
			...write.tags.length === 0 ? {} : { tags: write.tags },
			created: existing?.created ?? today,
			last_updated: today
		}, write.content);
		atomicWrite(this.sectionPath(safe), raw);
		return revOf(raw);
	}
	/** Append content to one section, creating it when absent. */
	appendSection(name, write) {
		const existing = this.readSection(name);
		if (existing === void 0) return this.writeSection(name, write);
		const merged = `${existing.content.trimEnd()}\n\n${write.content.trim()}`;
		return this.writeSection(name, {
			...write,
			content: merged
		});
	}
	entityPath(name) {
		return join(this.dir, "entities", `${name}.md`);
	}
	/** All entities sorted by name. */
	listEntities() {
		return listMarkdown(join(this.dir, "entities")).map((file) => this.readEntity(file.slice(0, -3))).filter((entry) => entry !== void 0).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
	}
	/** Read one entity; undefined when absent. */
	readEntity(name) {
		const raw = readText(this.entityPath(name));
		if (raw === void 0) return void 0;
		const note = parseNote(raw);
		return {
			name,
			title: fmString(note.frontmatter, "title") ?? name,
			tags: fmList(note.frontmatter, "tags"),
			status: fmString(note.frontmatter, "status") ?? "",
			created: fmString(note.frontmatter, "created") ?? "",
			lastUpdated: fmString(note.frontmatter, "last_updated") ?? "",
			content: note.body,
			rev: revOf(raw)
		};
	}
	/** Create or replace one entity; returns the written revision. */
	writeEntity(name, write) {
		const safe = safeName("entity", name);
		const existing = this.readEntity(safe);
		const today = dateStr();
		const raw = serializeNote({
			title: write.title,
			...write.tags.length === 0 ? {} : { tags: write.tags },
			...write.status === "" ? {} : { status: write.status },
			created: existing?.created ?? today,
			last_updated: today
		}, write.content);
		atomicWrite(this.entityPath(safe), raw);
		return revOf(raw);
	}
	observationsDir(archived) {
		return join(this.dir, "observations", ...archived ? ["archived"] : []);
	}
	observationPath(id, archived) {
		return join(this.observationsDir(archived), `${id}.md`);
	}
	/** Observations of one status, oldest first. */
	listObservations(status) {
		return listMarkdown(this.observationsDir(status === "archived")).map((file) => this.readObservation(file.slice(0, -3), status === "archived")).filter((entry) => entry !== void 0).sort((a, b) => a.id < b.id ? -1 : 1);
	}
	/** Read one observation; undefined when absent from that status slot. */
	readObservation(id, archived) {
		const raw = readText(this.observationPath(id, archived));
		if (raw === void 0) return void 0;
		const note = parseNote(raw);
		const parsedStatus = fmString(note.frontmatter, "status");
		const durable = fmBool(note.frontmatter, "durable");
		return {
			id,
			created: fmString(note.frontmatter, "created") ?? "",
			tags: fmList(note.frontmatter, "tags"),
			source: fmString(note.frontmatter, "source") ?? "agent",
			status: parsedStatus === "archived" ? "archived" : "open",
			...durable === void 0 ? {} : { durable },
			content: note.body
		};
	}
	/**
	* Create one observation file (pure create; never read-modify-write).
	* Content is trimmed and capped; tags/source/durable are metadata only.
	* @throws when the open pool is at capacity.
	*/
	createObservation(input, now = /* @__PURE__ */ new Date()) {
		const content = input.content.trim().slice(0, 2e3);
		const open = this.listObservations("open");
		if (open.length >= this.observationsMax) throw new Error(`observation pool is full (${open.length}/${this.observationsMax}); run a dream consolidation first`);
		const id = `obs-${timestampId(now)}-${Math.random().toString(16).slice(2, 6)}`;
		const raw = serializeNote({
			id,
			created: dateStr(now),
			status: "open",
			...input.tags.length === 0 ? {} : { tags: input.tags },
			...input.source === "" ? {} : { source: input.source },
			...input.durable === void 0 ? {} : { durable: String(input.durable) }
		}, content);
		atomicWrite(this.observationPath(id, false), raw);
		return id;
	}
	/**
	* Archive one open observation: write the archived copy (status flipped)
	* first, then unlink the original — a crash between the two leaves the
	* original re-listable and the re-run idempotently overwrites the copy.
	* @returns true when an open observation was archived.
	*/
	archiveObservation(id) {
		const open = this.readObservation(id, false);
		if (open === void 0) return false;
		const raw = serializeNote({
			id,
			created: open.created,
			status: "archived",
			...open.tags.length === 0 ? {} : { tags: open.tags },
			...open.source === "" ? {} : { source: open.source },
			...open.durable === void 0 ? {} : { durable: String(open.durable) }
		}, open.content);
		atomicWrite(this.observationPath(id, true), raw);
		try {
			unlinkSync(this.observationPath(id, false));
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
		return true;
	}
	/** Append one dream log entry (header line + body), verbatim. */
	appendLog(text) {
		const previous = readText(this.logPath()) ?? "# Dream Log\n";
		atomicWrite(this.logPath(), `${previous.trimEnd()}\n\n${text.trimEnd()}\n`);
	}
	/** Tail of the dream log (last `maxChars`, cut at a line boundary). */
	logTail(maxChars) {
		const raw = readText(this.logPath());
		if (raw === void 0) return "";
		if (raw.length <= maxChars) return raw.trimEnd();
		const cut = raw.slice(-maxChars);
		const firstNewline = cut.indexOf("\n");
		return (firstNewline >= 0 ? cut.slice(firstNewline + 1) : cut).trimEnd();
	}
	/** Rebuild the generated index from current vault contents. */
	rebuildIndex() {
		const sections = this.listSections();
		const entities = this.listEntities();
		const open = this.listObservations("open").length;
		const archived = this.listObservations("archived").length;
		const lines = [
			"# Vault Index",
			"",
			"> Generated by dream consolidation. Relationships live in `[[wikilinks]]` inside the notes.",
			"",
			"## Sections",
			...sections.length === 0 ? ["- (none)"] : sections.map((s) => `- [[sections/${s.name}|${s.title}]]`),
			"",
			"## Entities",
			...entities.length === 0 ? ["- (none)"] : entities.map((e) => `- [[entities/${e.name}|${e.title}]]`),
			"",
			"## Observations",
			`- open ${open} · archived ${archived}`,
			""
		];
		atomicWrite(this.indexPath(), lines.join("\n"));
	}
};
/**
* The memory core: scope resolution, read/projection/search surfaces, and
* the dream consolidation apply-loop. Deliberately free of Cordis types so
* the logic is unit-testable against a temp directory; the thin service
* wrapper (`YzjMemoryService`) only adds plugin lifetime.
*
* Governance recap (docs/spec/memory-vault-design.md §3): agents write
* observations only; dream sessions write sections/entities and dispose
* observations through validated, rev-checked decisions; humans may edit
* any file directly, and a dream never overwrites content it did not read
* (stale-rev items fail without touching the file).
* @module @dsh-yzj/memory-yzj/service
*/
/** Valid scope ids: `user` or `group:<id>` with a filesystem-safe group id. */
const SCOPE_RE = /^(user|group:[A-Za-z0-9_-]{1,64})$/;
/** Truncation marker appended when a projection exceeds its cap. */
const TRUNCATION_NOTE = "（已达注入上限，完整内容用 memory_read 查看）";
/**
* Memory core over one vault root. All methods are synchronous by design
* (small bounded files; sync access is atomic within one process).
*/
var MemoryCore = class {
	config;
	/** Last dream report per scope (executor result surface). */
	lastReports = /* @__PURE__ */ new Map();
	constructor(config) {
		this.config = config;
	}
	/** Absolute vault root (dream state file + executor session cwd). */
	get root() {
		return this.config.vaultRoot;
	}
	/** Validate and resolve one scope to its vault; ensures the skeleton. */
	vault(scope) {
		if (!SCOPE_RE.test(scope) || !this.config.allowScopes.includes(scope)) throw new Error(`memory-yzj: scope ${JSON.stringify(scope)} is not in allowScopes [${this.config.allowScopes.join(", ")}]`);
		const directory = scope === "user" ? "user" : scope.replace("group:", "group-");
		const vault = new MemoryVault(join(this.config.vaultRoot, directory), this.config.observationsMax, this.config.injectCharCap);
		vault.ensure();
		return vault;
	}
	/** Record one observation (deduped against identical open content). */
	observe(scope, input, now = /* @__PURE__ */ new Date()) {
		const vault = this.vault(scope);
		const content = input.content.trim();
		if (content === "") throw new Error("memory-yzj: observation content must not be empty");
		const tags = input.tags === void 0 ? [] : [...input.tags];
		const source = input.source === void 0 || input.source === "" ? "agent" : input.source;
		const open = vault.listObservations("open");
		const existing = open.find((item) => item.content === content.slice(0, 2e3));
		if (existing !== void 0) return {
			id: existing.id,
			duplicate: true,
			openCount: open.length,
			capacity: this.config.observationsMax
		};
		return {
			id: vault.createObservation({
				content,
				tags,
				source,
				...input.durable === void 0 ? {} : { durable: input.durable }
			}, now),
			duplicate: false,
			openCount: open.length + 1,
			capacity: this.config.observationsMax
		};
	}
	/** Bounded read view of one scope. */
	readScope(scope) {
		const vault = this.vault(scope);
		const sections = vault.listSections();
		const entities = vault.listEntities();
		return {
			scope,
			cap: vault.cap(),
			sections: sections.map((s) => ({
				name: s.name,
				title: s.title,
				order: s.order,
				excerpt: excerptOf(s.content)
			})),
			entities: entities.map((e) => ({
				name: e.name,
				title: e.title,
				excerpt: excerptOf(e.content)
			})),
			observations: vault.listObservations("open"),
			archivedCount: vault.listObservations("archived").length
		};
	}
	/** Injection projection: sections in order under a header, capped. */
	projection(scope) {
		const vault = this.vault(scope);
		const cap = vault.cap();
		const parts = vault.listSections().map((s) => `## ${s.title}\n\n${s.content.trim()}`);
		if (parts.length === 0) return {
			text: "",
			truncated: false,
			chars: 0,
			cap
		};
		const full = `# 记忆库 · ${scope}\n\n${parts.join("\n\n")}`;
		if (full.length <= cap) return {
			text: full,
			truncated: false,
			chars: full.length,
			cap
		};
		const cut = full.slice(0, cap).trimEnd();
		return {
			text: `${cut}\n\n${TRUNCATION_NOTE}`,
			truncated: true,
			chars: cut.length,
			cap
		};
	}
	/** Joined injection text over `injectScopes`; empty string when all empty. */
	injectText() {
		const blocks = [];
		for (const scope of this.config.injectScopes) {
			const { text } = this.projection(scope);
			if (text !== "") blocks.push(text);
		}
		return blocks.join("\n\n---\n\n");
	}
	/** Deterministic multi-token keyword search across one scope. */
	search(scope, query) {
		const tokens = query.toLowerCase().split(/\s+/).filter((token) => token !== "");
		if (tokens.length === 0) return [];
		const vault = this.vault(scope);
		const hits = [];
		for (const section of vault.listSections()) {
			const hit = scoreNote(section.title, section.tags, section.content, tokens);
			if (hit !== void 0) hits.push({
				kind: "section",
				ref: section.name,
				score: hit.score,
				line: hit.line
			});
		}
		for (const entity of vault.listEntities()) {
			const hit = scoreNote(entity.title, entity.tags, entity.content, tokens);
			if (hit !== void 0) hits.push({
				kind: "entity",
				ref: entity.name,
				score: hit.score,
				line: hit.line
			});
		}
		for (const observation of vault.listObservations("open")) {
			const hit = scoreNote("", observation.tags, observation.content, tokens);
			if (hit !== void 0) hits.push({
				kind: "observation",
				ref: observation.id,
				score: hit.score,
				line: hit.line
			});
		}
		const kindRank = {
			section: 0,
			entity: 1,
			observation: 2
		};
		return hits.sort((a, b) => b.score - a.score || kindRank[a.kind] - kindRank[b.kind] || (a.ref < b.ref ? -1 : 1)).slice(0, this.config.maxSearchHits);
	}
	/** Full snapshot with revisions, the entry surface of a dream run. */
	dreamLoad(scope) {
		const vault = this.vault(scope);
		return {
			scope,
			cap: vault.cap(),
			sections: vault.listSections(),
			entities: vault.listEntities(),
			observations: vault.listObservations("open"),
			archivedCount: vault.listObservations("archived").length
		};
	}
	/** Tail of the scope's dream log (UI transparency surface). */
	dreamLogTail(scope, maxChars = 4e3) {
		return this.vault(scope).logTail(maxChars);
	}
	/** The most recent dream report of one scope, when any apply happened. */
	lastDreamReport(scope) {
		return this.lastReports.get(scope);
	}
	/**
	* Apply one dream's decision list item by item. Every item is validated
	* against the current files; a stale rev (file changed since load) or a
	* missing target rejects that item only — the rest still apply. The log
	* entry and index rebuild always run, so a report exists even when every
	* item was rejected.
	*/
	dreamApply(scope, decisions, summary, now = /* @__PURE__ */ new Date()) {
		const vault = this.vault(scope);
		const results = [];
		const counts = {
			promoted: 0,
			dropped: 0,
			sectionsWritten: 0,
			entitiesWritten: 0,
			rejected: 0
		};
		for (const decision of decisions) try {
			results.push(applyDecision(vault, decision, counts));
		} catch (error) {
			counts.rejected += 1;
			results.push({
				decision: decision.type,
				ok: false,
				detail: describeDecision(decision),
				reason: reasonOf(error)
			});
		}
		const logId = `${dateStr(now)} ${Math.random().toString(16).slice(2, 10)}`;
		const lines = [
			`## [${logId}] dream`,
			"",
			summary.trim(),
			""
		];
		for (const result of results) lines.push(`${result.ok ? "- " : "- ✗ "}${result.decision} — ${result.detail}${result.reason === void 0 ? "" : ` (rejected: ${result.reason})`}`);
		vault.appendLog(lines.join("\n"));
		vault.rebuildIndex();
		const report = {
			scope,
			logId,
			results,
			counts
		};
		this.lastReports.set(scope, report);
		return report;
	}
	/**
	* Apply one dream from raw tool input: each entry is parsed and validated
	* first; malformed entries become pre-rejected report items instead of
	* failing the whole batch. Valid entries flow through {@link dreamApply}.
	*/
	dreamApplyRaw(scope, raws, summary, now = /* @__PURE__ */ new Date()) {
		const decisions = [];
		const invalid = [];
		for (const raw of raws) {
			const type = typeof raw === "object" && raw !== null ? String(raw.type ?? "") : "";
			try {
				decisions.push(parseDecision(raw));
			} catch (error) {
				invalid.push({
					decision: type === "" ? "(missing type)" : type,
					ok: false,
					detail: describeRaw(raw),
					reason: error instanceof Error ? error.message : String(error)
				});
			}
		}
		const report = this.dreamApply(scope, decisions, summary, now);
		if (invalid.length === 0) return report;
		return {
			...report,
			results: [...invalid, ...report.results],
			counts: {
				...report.counts,
				rejected: report.counts.rejected + invalid.length
			}
		};
	}
};
/** Short description of one malformed raw decision entry. */
function describeRaw(raw) {
	return JSON.stringify(raw).slice(0, 120);
}
/** Parse and validate one raw decision entry into the typed shape. */
function parseDecision(raw) {
	if (typeof raw !== "object" || raw === null) throw new Error("decision must be an object");
	const record = raw;
	const type = record["type"];
	const allowed = [
		"promote_observation",
		"drop_observation",
		"update_section",
		"upsert_entity",
		"log_only"
	];
	if (typeof type !== "string" || !allowed.includes(type)) throw new Error(`decision.type must be one of ${allowed.join(" | ")}`);
	const optional = (key) => {
		const value = record[key];
		if (value === void 0) return void 0;
		if (typeof value !== "string") throw new Error(`decision.${key} must be a string`);
		return value;
	};
	const tags = record["tags"];
	if (tags !== void 0 && (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string"))) throw new Error("decision.tags must be an array of strings");
	const order = record["order"];
	if (order !== void 0 && (typeof order !== "number" || !Number.isFinite(order))) throw new Error("decision.order must be a number");
	const observationId = optional("observationId");
	const section = optional("section");
	const entity = optional("entity");
	const content = optional("content");
	const title = optional("title");
	const status = optional("status");
	const rev = optional("rev");
	const note = optional("note");
	return {
		type,
		...observationId === void 0 ? {} : { observationId },
		...section === void 0 ? {} : { section },
		...entity === void 0 ? {} : { entity },
		...content === void 0 ? {} : { content },
		...title === void 0 ? {} : { title },
		...order === void 0 ? {} : { order },
		...Array.isArray(tags) ? { tags } : {},
		...status === void 0 ? {} : { status },
		...rev === void 0 ? {} : { rev },
		...note === void 0 ? {} : { note }
	};
}
/** Clip one note body to a single-line excerpt. */
function excerptOf(content) {
	const line = content.split("\n").find((part) => part.trim() !== "") ?? "";
	return line.length > 120 ? `${line.slice(0, 120)}…` : line;
}
/** Score one note against lowercase tokens; undefined when nothing matched. */
function scoreNote(title, tags, content, tokens) {
	const haystackTitle = `${title} ${tags.join(" ")}`.toLowerCase();
	const haystackBody = content.toLowerCase();
	let score = 0;
	let bestLine = "";
	for (const token of tokens) {
		if (haystackTitle.includes(token)) score += 2;
		let occurrences = 0;
		let index = haystackBody.indexOf(token);
		while (index >= 0 && occurrences < 5) {
			occurrences += 1;
			index = haystackBody.indexOf(token, index + token.length);
		}
		score += occurrences;
		if (bestLine === "" && occurrences > 0) {
			const source = content.split("\n").find((part) => part.toLowerCase().includes(token)) ?? "";
			bestLine = source.length > 160 ? `${source.slice(0, 160)}…` : source;
		}
	}
	return score === 0 ? void 0 : {
		score,
		line: bestLine
	};
}
/** Human-readable one-line description of a decision for the report. */
function describeDecision(decision) {
	switch (decision.type) {
		case "promote_observation": return `${decision.observationId ?? "?"} → sections/${decision.section ?? "?"}`;
		case "drop_observation": return decision.observationId ?? "?";
		case "update_section": return `sections/${decision.section ?? "?"}`;
		case "upsert_entity": return `entities/${decision.entity ?? "?"}`;
		case "log_only": return decision.note ?? "";
	}
}
/** Map one apply error to a stable reason code (fallback: the message). */
function reasonOf(error) {
	const message = error instanceof Error ? error.message : String(error);
	if (message.includes("rev")) return "rev-conflict";
	if (message.includes("not found")) return "not-found";
	if (message.includes("must not be empty") || message.includes("not allowed in file names")) return "invalid-name";
	if (message.includes("exceeds")) return "content-too-long";
	return message;
}
/** Validate and apply one decision; throws with reason-compatible messages. */
function applyDecision(vault, decision, counts) {
	switch (decision.type) {
		case "promote_observation": {
			const id = requireString(decision.observationId, "observationId");
			const sectionName = requireString(decision.section, "section");
			const content = requireContent(decision.content, 2e3, "content");
			const observation = vault.readObservation(id, false);
			if (observation === void 0) throw new Error(`${id} not found in open observations`);
			const existing = vault.readSection(sectionName);
			checkRev(existing?.rev, decision.rev, `sections/${sectionName}`);
			const order = decision.order ?? existing?.order ?? nextOrder(vault);
			vault.appendSection(sectionName, {
				title: decision.title ?? existing?.title ?? sectionName,
				order,
				tags: decision.tags ?? existing?.tags ?? observation.tags,
				content
			});
			vault.archiveObservation(id);
			counts.promoted += 1;
			counts.sectionsWritten += 1;
			return {
				decision: decision.type,
				ok: true,
				detail: `${id} → sections/${sectionName}`
			};
		}
		case "drop_observation": {
			const id = requireString(decision.observationId, "observationId");
			if (!vault.archiveObservation(id)) throw new Error(`${id} not found in open observations`);
			counts.dropped += 1;
			return {
				decision: decision.type,
				ok: true,
				detail: id
			};
		}
		case "update_section": {
			const sectionName = requireString(decision.section, "section");
			const content = requireContent(decision.content, 8e3, "content");
			const existing = vault.readSection(sectionName);
			checkRev(existing?.rev, decision.rev, `sections/${sectionName}`);
			vault.writeSection(sectionName, {
				title: decision.title ?? existing?.title ?? sectionName,
				order: decision.order ?? existing?.order ?? nextOrder(vault),
				tags: decision.tags ?? existing?.tags ?? [],
				content
			});
			counts.sectionsWritten += 1;
			return {
				decision: decision.type,
				ok: true,
				detail: `sections/${sectionName} (${existing === void 0 ? "created" : "rewritten"})`
			};
		}
		case "upsert_entity": {
			const entityName = requireString(decision.entity, "entity");
			const content = requireContent(decision.content, 8e3, "content");
			const existing = vault.readEntity(entityName);
			checkRev(existing?.rev, decision.rev, `entities/${entityName}`);
			vault.writeEntity(entityName, {
				title: decision.title ?? existing?.title ?? entityName,
				tags: decision.tags ?? existing?.tags ?? [],
				status: decision.status ?? existing?.status ?? "",
				content
			});
			counts.entitiesWritten += 1;
			return {
				decision: decision.type,
				ok: true,
				detail: `entities/${entityName} (${existing === void 0 ? "created" : "rewritten"})`
			};
		}
		case "log_only": return {
			decision: decision.type,
			ok: true,
			detail: decision.note ?? ""
		};
	}
}
/** Read a required string field of one decision. */
function requireString(value, field) {
	if (value === void 0 || value.trim() === "") throw new Error(`${field} must not be empty`);
	return value.trim();
}
/** Read required bounded content of one decision. */
function requireContent(value, max, field) {
	const text = requireString(value, field);
	if (text.length > max) throw new Error(`${field} exceeds ${max} characters`);
	return text;
}
/** Enforce the optional rev check: mismatch ⇒ rev-conflict; absent target with a rev ⇒ not found. */
function checkRev(currentRev, decisionRev, label) {
	if (decisionRev === void 0) return;
	if (currentRev === void 0) throw new Error(`${label} not found (rev supplied for a missing file)`);
	if (currentRev !== decisionRev) throw new Error(`stale rev for ${label}`);
}
/** First free order slot after the current maximum (new sections/entities). */
function nextOrder(vault) {
	const orders = vault.listSections().map((section) => section.order);
	return (orders.length === 0 ? 90 : Math.max(...orders)) + 10;
}
/**
* Dream consolidation state and execution contracts: the runtime switch,
* model route, and daily-schedule live in `<vaultRoot>/dream.json` (plain
* JSON, hand-editable, hot-reloaded on every read — a runtime toggle must
* not require a profile restart); the canonical dream prompt shared by the
* in-process executor and the (legacy) dsh-routines template; and the pure
* daily-fire predicate tested without timers.
*
* Governance (design §3): the switch gates every dream APPLICATION surface
* (the `memory_dream_apply` tool and the executor) in every process sharing
* the vault; observation writes are never gated — they are the component's
* point.
* @module @dsh-yzj/memory-yzj/dream
*/
/** Drop the provider/model pair when only half of it is present. */
function withoutHalfRoute(state) {
	if (state.provider !== void 0 && state.model !== void 0) return state;
	const { provider: _provider, model: _model, ...rest } = state;
	return rest;
}
/** Wall-clock budget for one in-process dream run (matches routine timeoutMin 10). */
const DREAM_RUN_TIMEOUT_MS = 6e5;
/** Local date key `YYYY-MM-DD`. */
function todayKey(now = /* @__PURE__ */ new Date()) {
	const pad = (n, width = 2) => String(n).padStart(width, "0");
	return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
/** Validate one `HH:mm` local time (24h). */
function isValidDailyAt(value) {
	return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
/** Path of the dream state file under one vault root. */
function dreamStatePath(vaultRoot) {
	return join(vaultRoot, "dream.json");
}
/** Read the dream settings; absent or malformed files read as the safe default. */
function readDreamSettings(vaultRoot) {
	try {
		const raw = readFileSync(dreamStatePath(vaultRoot), "utf8");
		const parsed = JSON.parse(raw);
		if (typeof parsed !== "object" || parsed === null) return { enabled: false };
		const record = parsed;
		return withoutHalfRoute({
			enabled: record.enabled === true,
			...typeof record.provider === "string" && record.provider.trim() !== "" ? { provider: record.provider.trim() } : {},
			...typeof record.model === "string" && record.model.trim() !== "" ? { model: record.model.trim() } : {},
			...typeof record.dailyAt === "string" && isValidDailyAt(record.dailyAt) ? { dailyAt: record.dailyAt } : {},
			...typeof record.lastRunDay === "string" ? { lastRunDay: record.lastRunDay } : {},
			...typeof record.lastNote === "string" ? { lastNote: record.lastNote } : {}
		});
	} catch {
		return { enabled: false };
	}
}
/** Persist the dream settings atomically (temp sibling + rename). */
function writeDreamSettings(vaultRoot, settings) {
	const path = dreamStatePath(vaultRoot);
	const tmp = `${path}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`;
	writeFileSync(tmp, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
	renameSync(tmp, path);
}
/**
* Merge a partial update into the persisted settings (whole-record replace).
* Invalid `dailyAt` values are dropped; a half route is normalized away;
* empty-string provider/model clear the route.
*/
function updateDreamSettings(vaultRoot, partial) {
	const current = readDreamSettings(vaultRoot);
	const merged = withoutHalfRoute({
		enabled: partial.enabled ?? current.enabled,
		...partial.provider === void 0 && partial.model === void 0 ? current.provider !== void 0 && current.model !== void 0 ? {
			provider: current.provider,
			model: current.model
		} : {} : {},
		...partial.provider !== void 0 && partial.provider !== "" && partial.model !== void 0 && partial.model !== "" ? {
			provider: partial.provider,
			model: partial.model
		} : {},
		...partial.dailyAt === void 0 && current.dailyAt !== void 0 ? { dailyAt: current.dailyAt } : {},
		...partial.dailyAt !== void 0 && isValidDailyAt(partial.dailyAt) ? { dailyAt: partial.dailyAt } : {},
		...partial.lastRunDay === void 0 && current.lastRunDay !== void 0 ? { lastRunDay: current.lastRunDay } : {},
		...partial.lastRunDay !== void 0 ? { lastRunDay: partial.lastRunDay } : {},
		...partial.lastNote === void 0 && current.lastNote !== void 0 ? { lastNote: current.lastNote } : {},
		...partial.lastNote !== void 0 ? { lastNote: partial.lastNote } : {}
	});
	writeDreamSettings(vaultRoot, merged);
	return merged;
}
/**
* Pure daily-fire predicate: true when the schedule is armed, the local time
* has passed today's `dailyAt`, and no run happened today yet.
*/
function shouldFireDaily(settings, now = /* @__PURE__ */ new Date()) {
	if (!settings.enabled || settings.dailyAt === void 0 || !isValidDailyAt(settings.dailyAt)) return false;
	if (settings.lastRunDay === todayKey(now)) return false;
	const [hour, minute] = settings.dailyAt.split(":").map((part) => Number.parseInt(part, 10));
	return now.getHours() * 60 + now.getMinutes() >= (hour ?? 0) * 60 + (minute ?? 0);
}
/** The canonical dream prompt (shared by the executor; the dsh-routines
* template mirrors it — keep the two in sync when the rules evolve). */
const DREAM_PROMPT = [
	"你是记忆固化引擎（dream），负责整理记忆库 user scope 的观察草稿区。严格按以下步骤工作：",
	"",
	"1. 调用 memory_dream_load(scope=\"user\") 获取记忆库现状（sections/entities 的内容与 rev、全部 open observations）。",
	"2. 对每条 open observation 依据佐证规则判定（先看 durable 标记）：",
	"   - durable=true（长期候选，agent/用户明确意图）→ 即使单源也应 promote_observation（并入合适的 section，content 写成自包含的陈述句；必要时同步 upsert_entity）；",
	"   - durable=false（便签）→ 默认 drop_observation；仅当信息构成尚未反映的新稳定事实且被其他来源佐证时才 promote；",
	"   - 未标记：单日单源信号 → 留观，不出决策；信息已被某个 section/entity 覆盖 → drop_observation；",
	"     多源或跨日佐证、或用户明确陈述的稳定事实/偏好/决策 → promote_observation；",
	"   - 过时或与现状矛盾 → update_section 重写该段（rev 必须来自本次 load）；",
	"   - 都不适用但值得留痕 → log_only。",
	"   注意：source 为 routine:* 的例行产出信号默认不直接提升（防自反馈），durable=true 除外。",
	"3. 段落的 order/title 保持 load 返回的原值，不要重排。",
	"4. 调用 memory_dream_apply(scope=\"user\", decisions=<JSON 数组字符串>, summary=\"<一句话摘要>\")。decisions 里每条 update_section/upsert_entity/promote_observation 引用 load 返回的 rev；单条被拒（rev-conflict 等）不影响其余条目，无需重试。",
	"5. 最后用一两句话总结固化结果。",
	"",
	"取材扩展（AI推进 ④期，决策 29）：可调用 yzj_advance_list(stage=all) 找到推进事项，yzj_advance_get 读其事元流；终局（completed/cancelled）事项的复盘/纪要类产物事元（refs 指向知识库 docId）是高价值固化素材——它们回答「哪些事做完了、做成了什么样、为什么黄了」。",
	"",
	"只使用 memory_* 与 yzj_advance_*（只读 list/get）工具；不要调用其他工具。"
].join("\n");
/**
* Model-facing memory tools: observe, read, search, and the two dream
* surfaces (load/apply). Digests are bounded; the structured payload rides
* `output.presentationMeta` exactly like the yzj tool family. Per the design
* (§3, D4) none of these enter the yzj WRITE_SPECS confirmation gate — the
* vault is local, human-auditable storage, not a Yunzhijia-side write.
* @module @dsh-yzj/memory-yzj/tools
*/
/** Shared output contract (same shape as the yzj tool family). */
const memoryToolOutput = {
	schema: {
		type: "object",
		additionalProperties: false,
		properties: {
			content: {
				type: "string",
				required: true
			},
			truncated: {
				type: "boolean",
				required: true
			},
			data: { type: "json" }
		}
	},
	render: (_args, value) => [{
		type: "text",
		text: value.content
	}],
	presentationMeta: (_args, value) => value.data
};
/** Clip a digest to the render budget. */
function clip(text, max) {
	return text.length <= max ? {
		content: text,
		truncated: false
	} : {
		content: `${text.slice(0, max)}\n…(truncated)`,
		truncated: true
	};
}
/** Clip a structured payload to the meta budget (whole-value replace on overflow). */
function clipMeta(value, max) {
	const text = JSON.stringify(value) ?? "null";
	if (text.length <= max) return JSON.parse(text);
	return {
		truncated: true,
		chars: text.length,
		preview: text.slice(0, max)
	};
}
/** Format the read view as a bounded digest. */
function durableLabel(observation) {
	if (observation.durable === true) return "（长期）";
	if (observation.durable === false) return "（便签）";
	return "";
}
/** Format the read view as a bounded digest. */
function readDigest(view) {
	const lines = [`scope ${view.scope} · 注入上限 ${view.cap} 字符`];
	lines.push("", `## sections (${view.sections.length})`);
	if (view.sections.length === 0) lines.push("- (none)");
	for (const section of view.sections) lines.push(`- ${section.name}（order ${section.order}）${section.excerpt}`);
	lines.push("", `## entities (${view.entities.length})`);
	if (view.entities.length === 0) lines.push("- (none)");
	for (const entity of view.entities) lines.push(`- ${entity.name} ${entity.excerpt}`);
	lines.push("", `## observations (${view.observations.length} open / ${view.archivedCount} archived)`);
	for (const observation of view.observations) {
		const tags = observation.tags.length === 0 ? "" : ` [${observation.tags.join(",")}]`;
		lines.push(`- ${observation.id} ${observation.created}${tags}${durableLabel(observation)} (${observation.source})`);
		lines.push(`  ${observation.content.split("\n")[0] ?? ""}`);
	}
	return lines.join("\n");
}
/** Format one search hit digest line. */
function hitLine(hit) {
	return `${hit.kind} ${hit.ref} · score ${hit.score}${hit.line === "" ? "" : `\n  ${hit.line}`}`;
}
/** Format the dream report digest. */
function reportDigest(report) {
	const { counts } = report;
	const head = `固化完成 [${report.logId}]：提升 ${counts.promoted} · 丢弃 ${counts.dropped} · 段写 ${counts.sectionsWritten} · 实体写 ${counts.entitiesWritten} · 拒绝 ${counts.rejected}`;
	const items = report.results.map((result) => `${result.ok ? "✓" : "✗"} ${result.decision} — ${result.detail}${result.reason === void 0 ? "" : ` (${result.reason})`}`);
	return items.length === 0 ? head : `${head}\n${items.join("\n")}`;
}
/** Parse the `decisions` JSON-string parameter into a raw entry array. */
function parseDecisionsJson(text) {
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch (error) {
		throw new Error(`decisions must be a JSON array: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!Array.isArray(parsed)) throw new Error("decisions must be a JSON array of decision objects");
	return parsed;
}
/** Register the five memory tools over one core.
* @param dreamGate - when provided and false, the apply tool refuses (the
* runtime dream switch in dream.json; read/write surfaces stay available). */
function applyMemoryTools(ctx, core, budget, dreamGate) {
	ctx.tools.register(defineTool({
		name: "memory_observe",
		description: "Record one observation into the memory vault scratchpad (a provisional signal, not yet curated memory). Observations are consolidated into sections/entities by the periodic dream; use this whenever the user states a durable preference, fact, decision, or project context worth keeping.",
		parameters: {
			content: {
				type: "string",
				required: true,
				description: "The signal to remember, self-contained (≤2000 chars; longer content is trimmed)."
			},
			tags: {
				type: "array",
				items: { type: "string" },
				description: "Optional free-form tags for later filtering."
			},
			scope: {
				type: "string",
				description: "Memory scope; defaults to \"user\"."
			},
			source: {
				type: "string",
				description: "Provenance label, e.g. \"routine:<id>\"; defaults to \"agent\"."
			},
			durable: {
				type: "boolean",
				description: "Intent mark: true = 长期候选（明确的稳定事实/偏好，dream 单源也可提升）；false = 便签（临时事务，dream 默认丢弃除非被佐证）；省略 = 中性（dream 按佐证规则判定）。"
			}
		},
		output: memoryToolOutput,
		isConcurrencySafe: () => true,
		async execute(args) {
			const result = core.observe(args.scope ?? "user", {
				content: args.content,
				tags: args.tags ?? [],
				source: args.source === void 0 || args.source === "" ? "agent" : args.source,
				...args.durable === void 0 ? {} : { durable: args.durable }
			});
			const mark = args.durable === true ? "（长期）" : args.durable === false ? "（便签）" : "";
			const { content, truncated } = clip(`${result.duplicate ? "已有相同观察" : "已记录观察"} ${result.id}${mark}（scope ${args.scope ?? "user"}，open ${result.openCount}/${result.capacity}）`, budget.maxRenderChars);
			return {
				content,
				truncated,
				data: clipMeta(result, budget.maxMetaChars)
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "memory_read",
		description: "Read one memory scope: section summaries, entity summaries, and full open observations. Injected context is capped, so use this for the complete picture before answering with memory or before editing.",
		parameters: { scope: {
			type: "string",
			description: "Memory scope; defaults to \"user\"."
		} },
		output: memoryToolOutput,
		isConcurrencySafe: () => true,
		async execute(args) {
			const view = core.readScope(args.scope ?? "user");
			const { content, truncated } = clip(readDigest(view), budget.maxRenderChars);
			return {
				content,
				truncated,
				data: clipMeta(view, budget.maxMetaChars)
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "memory_search",
		description: "Deterministic keyword search over one memory scope (sections, entities, open observations). Tokens match title/tags and content; hits carry the best matching line.",
		parameters: {
			query: {
				type: "string",
				required: true,
				description: "Whitespace-separated keywords."
			},
			scope: {
				type: "string",
				description: "Memory scope; defaults to \"user\"."
			}
		},
		output: memoryToolOutput,
		isConcurrencySafe: () => true,
		async execute(args) {
			const hits = core.search(args.scope ?? "user", args.query);
			const { content, truncated } = clip(hits.length === 0 ? "(no matches)" : hits.map(hitLine).join("\n"), budget.maxRenderChars);
			return {
				content,
				truncated,
				data: clipMeta({ hits }, budget.maxMetaChars)
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "memory_dream_load",
		description: "Dream entry point: load one memory scope's full state — sections and entities with content revisions (rev), and every open observation. Weigh each observation against the corroboration rules, then submit decisions with memory_dream_apply referencing the revs returned here.",
		parameters: { scope: {
			type: "string",
			required: true,
			description: "Memory scope to consolidate (e.g. \"user\")."
		} },
		output: memoryToolOutput,
		isConcurrencySafe: () => true,
		async execute(args) {
			const state = core.dreamLoad(args.scope);
			const { content, truncated } = clip(`${`scope ${state.scope} · ${state.sections.length} sections / ${state.entities.length} entities / ${state.observations.length} open observations`}\n\n对每条 open observation 判定（先看 durable 标记）：durable=true（长期）单源也可 promote；durable=false（便签）默认 drop；未标记按佐证规则（多源 promote / 已覆盖 drop / 单源留观）。过时段落用 update_section 重写。decisions 必须引用本 load 返回的 rev。`, budget.maxRenderChars);
			return {
				content,
				truncated,
				data: clipMeta(state, budget.maxMetaChars)
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "memory_dream_apply",
		description: "Apply one dream's decisions to a memory scope: promote/drop observations, rewrite sections, upsert entities. Each item is validated (stale rev or missing target rejects that item only); the log and index are always rebuilt. Call once per dream after memory_dream_load.",
		parameters: {
			scope: {
				type: "string",
				required: true,
				description: "Memory scope being consolidated."
			},
			decisions: {
				type: "string",
				required: true,
				description: "JSON array of decisions; each item {type: promote_observation|drop_observation|update_section|upsert_entity|log_only, …fields, rev? from dream load}."
			},
			summary: {
				type: "string",
				required: true,
				description: "One-paragraph human-readable dream summary for the log."
			}
		},
		output: memoryToolOutput,
		async execute(args) {
			if (dreamGate !== void 0 && !dreamGate()) throw new Error("dream 未开启：固化被 dream.json 的 enabled=false 拒绝（在面板或配置中开启后重试；观察与读取不受影响）");
			const report = core.dreamApplyRaw(args.scope, parseDecisionsJson(args.decisions), args.summary);
			const { content, truncated } = clip(reportDigest(report), budget.maxRenderChars);
			return {
				content,
				truncated,
				data: clipMeta(report, budget.maxMetaChars)
			};
		}
	}));
}
/**
* memory-yzj: a Markdown memory vault for DSH agents (host half). Provides
* `ctx.yzjMemory` (scope-addressed observe/read/search + dream consolidation)
* and five model-facing tools, and — when the `systemPrompt` service is
* present — injects the configured scopes' bounded projection into every
* prompt assembly as the `yzj-memory` dynamic context.
*
* Storage is plain files under one vault root (default
* `$DSH_HOME/yzj-memory`), one subdirectory per scope, so every profile on
* the machine (web, headless routines, ops) shares the same memory with no
* runtime coupling; see docs/spec/memory-vault-design.md for the contracts.
* @module @dsh-yzj/memory-yzj
*/
/** Cordis plugin name used by loader diagnostics. */
const name = "memory-yzj";
/** Hard dependency: the tool registry. `systemPrompt` is read opportunistically. */
const inject = ["tools"];
const Config = z.object({
	vaultRoot: z.string(),
	allowScopes: z.array(z.string()).default(["user"]),
	injectScopes: z.array(z.string()).default(["user"]),
	injectCharCap: z.number().step(1).min(200).default(6e3),
	observationsMax: z.number().step(1).min(1).default(200),
	maxRenderChars: z.number().step(1).min(1e3).default(2e4),
	maxMetaChars: z.number().step(1).min(1e3).default(5e4),
	maxSearchHits: z.number().step(1).min(1).max(100).default(20)
});
/** The memory service: thin lifetime owner over the pure {@link MemoryCore}. */
var YzjMemoryService = class extends Service {
	static inject = ["tools"];
	/** The pure core every method delegates to (also used directly by tests). */
	core;
	constructor(ctx, config) {
		super(ctx, "yzjMemory");
		const coreConfig = {
			vaultRoot: config.vaultRoot !== void 0 && config.vaultRoot !== "" ? expandHomePath(config.vaultRoot) : join(resolveDshHome(), "yzj-memory"),
			allowScopes: config.allowScopes ?? ["user"],
			injectScopes: config.injectScopes ?? ["user"],
			injectCharCap: config.injectCharCap ?? 6e3,
			observationsMax: config.observationsMax ?? 200,
			maxSearchHits: config.maxSearchHits ?? 20
		};
		this.core = new MemoryCore(coreConfig);
	}
	/** Record one observation (deduped); see {@link MemoryCore.observe}. */
	observe(scope, content, options = {}) {
		return this.core.observe(scope, {
			content,
			tags: options.tags ?? [],
			source: options.source ?? "agent",
			...options.durable === void 0 ? {} : { durable: options.durable }
		});
	}
	/** Bounded read view; see {@link MemoryCore.readScope}. */
	readScope(scope) {
		return this.core.readScope(scope);
	}
	/** Injection projection; see {@link MemoryCore.projection}. */
	projection(scope) {
		return this.core.projection(scope);
	}
	/** Deterministic keyword search; see {@link MemoryCore.search}. */
	search(scope, query) {
		return this.core.search(scope, query);
	}
	/** Dream state with revisions; see {@link MemoryCore.dreamLoad}. */
	dreamLoad(scope) {
		return this.core.dreamLoad(scope);
	}
	/** Tail of the scope's dream log; see {@link MemoryCore.dreamLogTail}. */
	dreamLogTail(scope, maxChars) {
		return this.core.dreamLogTail(scope, maxChars);
	}
	/** Apply typed decisions; see {@link MemoryCore.dreamApply}. */
	dreamApply(scope, decisions, summary) {
		return this.core.dreamApply(scope, decisions, summary);
	}
	/** Joined injection text over the configured inject scopes. */
	injectText() {
		return this.core.injectText();
	}
	/** Current dream settings (runtime switch / model / schedule). */
	dreamSettings() {
		return readDreamSettings(this.core.root);
	}
	/** Merge a partial update into the dream settings; returns the new state. */
	setDreamSettings(partial) {
		return updateDreamSettings(this.core.root, partial);
	}
	dreamInFlight = false;
	/**
	* Run one dream consolidation in-process: a fresh one-shot agent session
	* (full session log = audit) driven by the canonical dream prompt, with
	* the model resolved as dream.json route > plugin default (yzjModels) >
	* harness default. Refuses when the switch is off or a run is in flight.
	*/
	async dreamRun(trigger) {
		const state = this.dreamSettings();
		if (!state.enabled) return {
			ok: false,
			error: "dream 未开启（dream.json enabled=false）"
		};
		if (this.dreamInFlight) return {
			ok: false,
			error: "已有 dream 正在运行，请稍候"
		};
		const agents = this.ctx.get("agents");
		if (agents === void 0) return {
			ok: false,
			error: "agents 服务不可用（dream 执行器需要 web/headless profile）"
		};
		this.core.vault("user");
		const route = state.provider !== void 0 && state.model !== void 0 ? {
			provider: state.provider,
			model: state.model
		} : this.ctx.get("yzjModels")?.get();
		const sessionId = `dream-${timestampId()}-${Math.random().toString(16).slice(2, 6)}`;
		this.dreamInFlight = true;
		try {
			const handle = await agents.create({
				sessionId: SessionId(sessionId),
				meta: { cwd: this.core.root },
				...route === void 0 ? {} : { agentOptions: route }
			});
			handle.agent.followup(createUserMessage({
				content: [{
					type: "text",
					text: DREAM_PROMPT
				}],
				source: {
					kind: "plugin",
					plugin: "memory-yzj"
				}
			}));
			const timedOut = await Promise.race([handle.agent.whenIdle().then(() => false), new Promise((resolve) => {
				setTimeout(() => resolve(true), DREAM_RUN_TIMEOUT_MS);
			})]);
			const report = this.core.lastDreamReport("user");
			const note = timedOut ? `固化会话 ${sessionId} 超过 ${Math.round(DREAM_RUN_TIMEOUT_MS / 6e4)} 分钟未收敛（会话仍在后台运行，结果稍后见固化日志）` : report === void 0 ? `固化会话 ${sessionId} 已完成，但未产生固化报告（可查会话日志排查）` : `固化完成：提升 ${report.counts.promoted} · 丢弃 ${report.counts.dropped} · 段写 ${report.counts.sectionsWritten} · 实体写 ${report.counts.entitiesWritten} · 拒绝 ${report.counts.rejected}`;
			updateDreamSettings(this.core.root, { lastNote: `${todayKey()} ${trigger}：${note}` });
			return {
				ok: true,
				sessionId,
				...report === void 0 ? {} : { report },
				note
			};
		} catch (error) {
			const errorNote = `固化失败：${error instanceof Error ? error.message : String(error)}`;
			updateDreamSettings(this.core.root, { lastNote: `${todayKey()} ${trigger}：${errorNote}` });
			return {
				ok: false,
				error: errorNote
			};
		} finally {
			this.dreamInFlight = false;
		}
	}
	/** One scheduler tick: fire the daily dream when due (idempotent per day). */
	tickDaily() {
		if (!shouldFireDaily(this.dreamSettings())) return;
		updateDreamSettings(this.core.root, { lastRunDay: todayKey() });
		this.dreamRun("schedule");
	}
};
/** Plugin entry: service + tools + (optional) prompt-injection context + daily tick. */
function apply(ctx, config) {
	const service = new YzjMemoryService(ctx, config);
	applyMemoryTools(ctx, service.core, {
		maxRenderChars: config.maxRenderChars ?? 2e4,
		maxMetaChars: config.maxMetaChars ?? 5e4
	}, () => service.dreamSettings().enabled);
	const systemPrompt = ctx.get("systemPrompt");
	if (systemPrompt !== void 0) ctx.effect(() => systemPrompt.context({
		name: "yzj-memory",
		order: 0,
		text: () => service.core.injectText()
	}));
	ctx.effect(() => {
		const timer = setInterval(() => {
			service.tickDaily();
		}, 6e4);
		return () => clearInterval(timer);
	});
}
//#endregion
export { Config, DEFAULT_INJECT_CHAR_CAP, DREAM_PROMPT, DREAM_RUN_TIMEOUT_MS, MemoryCore, MemoryVault, YzjMemoryService, apply, inject, name, parseDecision, shouldFireDaily, todayKey };
