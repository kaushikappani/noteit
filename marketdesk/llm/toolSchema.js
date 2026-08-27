/**
 * Tool + schema translation.
 *
 * The rest of the module only ever writes plain JSON Schema. Everything that
 * makes one provider's function-calling dialect different from another's is
 * confined to this file.
 */

// Gemini's Schema type accepts only this OpenAPI-3 subset. Anything else — most
// notably additionalProperties and $schema, which every JSON Schema generator
// emits — is rejected outright rather than ignored, so it has to be stripped.
const GEMINI_ALLOWED = new Set([
    "type", "format", "description", "nullable", "enum", "items", "properties", "required",
]);

const GEMINI_TYPES = {
    string: "STRING", number: "NUMBER", integer: "INTEGER",
    boolean: "BOOLEAN", array: "ARRAY", object: "OBJECT",
};

/** Recursively reduce a JSON Schema to what Gemini will accept. */
function toGeminiSchema(schema) {
    if (!schema || typeof schema !== "object") return undefined;

    // Gemini has no oneOf/anyOf in this dialect; collapse to the first branch,
    // which is enough for the tool arguments we actually declare.
    const src = schema.oneOf?.[0] || schema.anyOf?.[0] || schema;

    const out = {};
    for (const [key, value] of Object.entries(src)) {
        if (!GEMINI_ALLOWED.has(key)) continue;
        if (key === "type") {
            const t = Array.isArray(value) ? value.find((v) => v !== "null") : value;
            out.type = GEMINI_TYPES[String(t).toLowerCase()] || "STRING";
        } else if (key === "items") {
            out.items = toGeminiSchema(value);
        } else if (key === "properties") {
            out.properties = {};
            for (const [prop, sub] of Object.entries(value)) {
                const converted = toGeminiSchema(sub);
                if (converted) out.properties[prop] = converted;
            }
        } else {
            out[key] = value;
        }
    }
    // Gemini rejects the whole request when a name in "required" is not a
    // defined property, so one stale entry after a field rename kills every
    // call using the schema. Drop the unknown names and carry on: a lost
    // constraint is far cheaper than a dead edition.
    if (Array.isArray(out.required) && out.properties) {
        const known = out.required.filter((r) => out.properties[r] !== undefined);
        if (known.length !== out.required.length) {
            const dropped = out.required.filter((r) => out.properties[r] === undefined);
            console.warn(
                "[marketdesk/llm] schema requires undefined propert" +
                (dropped.length > 1 ? "ies: " : "y: ") + dropped.join(", ") + " - dropped"
            );
        }
        out.required = known.length ? known : undefined;
    }
    if (!out.type) out.type = out.properties ? "OBJECT" : "STRING";
    // An OBJECT with no properties is an error on Gemini's side, not an empty object.
    if (out.type === "OBJECT" && out.properties && !Object.keys(out.properties).length) return undefined;
    return out;
}

const hasParams = (t) => !!(t.parameters && Object.keys(t.parameters.properties || {}).length);

/**
 * Tier-B tools only. Gemini's server-side search is NOT declarable alongside
 * these — see llm/search/geminiGrounding.js for why that is a separate call.
 */
function toGeminiTools(tools = []) {
    if (!tools.length) return undefined;
    const functionDeclarations = tools.map((t) => {
        const decl = { name: t.name, description: t.description || "" };
        // Omitted entirely rather than sent empty, which Gemini rejects.
        if (hasParams(t)) {
            const params = toGeminiSchema(t.parameters);
            if (params) decl.parameters = params;
        }
        return decl;
    });
    return [{ functionDeclarations }];
}

function toOpenAITools(tools = []) {
    if (!tools.length) return undefined;
    return tools.map((t) => ({
        type: "function",
        function: {
            name: t.name,
            description: t.description || "",
            parameters: hasParams(t)
                ? t.parameters
                : { type: "object", properties: {}, additionalProperties: false },
        },
    }));
}

function toGeminiToolConfig(toolChoice) {
    if (!toolChoice || toolChoice === "auto") return undefined;
    if (toolChoice === "none") return { functionCallingConfig: { mode: "NONE" } };
    if (typeof toolChoice === "object" && toolChoice.name) {
        return { functionCallingConfig: { mode: "ANY", allowedFunctionNames: [toolChoice.name] } };
    }
    return undefined;
}

function toOpenAIToolChoice(toolChoice) {
    if (!toolChoice || toolChoice === "auto") return undefined;
    if (toolChoice === "none") return "none";
    if (typeof toolChoice === "object" && toolChoice.name) {
        return { type: "function", function: { name: toolChoice.name } };
    }
    return undefined;
}

module.exports = {
    toGeminiSchema, toGeminiTools, toOpenAITools,
    toGeminiToolConfig, toOpenAIToolChoice,
};
