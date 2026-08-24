/**
 * Tool registry.
 *
 * A tool is a name, a description, a JSON Schema for its arguments, and a
 * handler. Nothing here knows which provider will consume the schema — that
 * translation lives in llm/toolSchema.js.
 */

class ToolRegistry {
    constructor() { this.tools = new Map(); }

    /**
     * @param {{name:string, description:string, parameters?:object,
     *          handler:(args:object, ctx:object)=>Promise<any>}} tool
     */
    register(tool) {
        if (!tool?.name || typeof tool.handler !== "function") {
            throw new Error("a tool needs at least a name and a handler");
        }
        this.tools.set(tool.name, tool);
        return this;
    }

    registerAll(tools = []) {
        tools.forEach((t) => this.register(t));
        return this;
    }

    /** Only the subset given to the model — the handler is not sent anywhere. */
    declarations(names) {
        const wanted = names?.length ? names : [...this.tools.keys()];
        return wanted
            .filter((n) => this.tools.has(n))
            .map((n) => {
                const { name, description, parameters } = this.tools.get(n);
                return { name, description, parameters };
            });
    }

    get(name) { return this.tools.get(name); }
    has(name) { return this.tools.has(name); }
    names() { return [...this.tools.keys()]; }
}

module.exports = { ToolRegistry };
