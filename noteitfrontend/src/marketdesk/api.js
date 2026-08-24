/**
 * One axios instance for the whole MarketDesk UI.
 *
 * Cookie auth, so nothing here handles tokens — the same pattern the rest of the
 * app uses (see pages/StockScreener.js). Keeping the base path in one place is
 * also what lets this folder move to another app unchanged.
 */

import axios from "axios";

const api = axios.create({
    baseURL: "/api/marketdesk",
    withCredentials: true,
});

/** Turn an axios failure into something worth showing a person. */
export function errorMessage(err) {
    if (err?.response?.status === 403) return "You do not have access to MarketDesk.";
    if (err?.response?.status === 401) return "Your session expired. Please sign in again.";
    return err?.response?.data?.message || err.message || "Something went wrong.";
}

export const getLatestEdition = () => api.get("/editions/latest").then((r) => r.data);
export const getEditions = (limit = 20) => api.get("/editions", { params: { limit } }).then((r) => r.data);
export const getEdition = (date, slot) => api.get(`/editions/${date}/${slot}`).then((r) => r.data);
export const buildEdition = (body) => api.post("/editions/build", body).then((r) => r.data);
export const deliverEdition = (id, body) => api.post(`/editions/${id}/deliver`, body).then((r) => r.data);

export const getCompanies = () => api.get("/companies").then((r) => r.data);
export const getCompany = (symbol) => api.get(`/companies/${symbol}`).then((r) => r.data);
export const getCompanyFilings = (symbol, params) =>
    api.get(`/companies/${symbol}/filings`, { params }).then((r) => r.data);

export const getWatchlist = () => api.get("/watchlist").then((r) => r.data);
export const putWatchlist = (symbols) => api.put("/watchlist", { symbols }).then((r) => r.data);
export const seedWatchlist = () => api.post("/watchlist/seed").then((r) => r.data);

export const getConfig = () => api.get("/config").then((r) => r.data);
export const putConfig = (patch) => api.put("/config", patch).then((r) => r.data);

export const getStatus = () => api.get("/status").then((r) => r.data);
export const runIngest = (body) => api.post("/ingest", body).then((r) => r.data);

export default api;
