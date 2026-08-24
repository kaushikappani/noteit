/**
 * Tolerant JSON extraction.
 *
 * Even with a response schema attached, a model occasionally wraps its object in
 * a code fence or a sentence. Failing the whole edition over that would be
 * absurd, so slice out the outermost object and parse that.
 */

function parseJsonLoose(raw, { fallback } = {}) {
    if (raw && typeof raw === "object") return raw;
    const text = String(raw || "").trim();
    if (!text) {
        if (fallback !== undefined) return fallback;
        throw new Error("empty response where JSON was expected");
    }

    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start !== -1 && end > start) {
        try {
            return JSON.parse(cleaned.slice(start, end + 1));
        } catch (err) {
            if (fallback !== undefined) return fallback;
            throw new Error(`could not parse JSON: ${err.message}`);
        }
    }
    if (fallback !== undefined) return fallback;
    throw new Error(`no JSON object found in: ${cleaned.slice(0, 200)}`);
}

/** Coerce to a string array, since models flip between a list and a blob. */
function asArray(value, limit = 10) {
    if (Array.isArray(value)) {
        return value.map((v) => String(v).trim()).filter(Boolean).slice(0, limit);
    }
    if (typeof value === "string" && value.trim()) {
        return value
            .split(/\r?\n+/)
            // Strip a leading bullet or "1." marker, but leave a line that merely
            // starts with a number alone: "2024 revenue grew" is not a list marker.
            .map((s) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
            .filter(Boolean)
            .slice(0, limit);
    }
    return [];
}

module.exports = { parseJsonLoose, asArray };
