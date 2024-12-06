import React, { useState, useEffect } from "react";
import axios from "axios";
import { Table } from "react-bootstrap";
import { Collapse, Box, Typography, CircularProgress } from "@mui/material";

const PortfolioTable = ({ portfolioData, setPortfolioData ,loading,error}) => {
    const [expandedRow, setExpandedRow] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: "", direction: "" });

    // Fetch portfolio data
    

    const handleRowClick = (symbol) => {
        setExpandedRow(expandedRow === symbol ? null : symbol);
    };

    const handleSort = (key) => {
        const direction = sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
        setSortConfig({ key, direction });
        const sortedData = [...portfolioData].sort((a, b) => {
            if (a[key] < b[key]) return direction === "asc" ? -1 : 1;
            if (a[key] > b[key]) return direction === "asc" ? 1 : -1;
            return 0;
        });
        setPortfolioData(sortedData);
    };

    if (loading) {
        return (
            <div className="text-center mt-5">
                <CircularProgress />
                <Typography variant="h6" className="mt-2">
                    Loading Portfolio Data...
                </Typography>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center mt-5">
                <Typography variant="h6" color="error">
                    Failed to load data: {error}
                </Typography>
            </div>
        );
    }

    return (
        <div className="container mt-4">
            <Table bordered hover responsive>
                <thead>
                    <tr>
                        <th onClick={() => handleSort("symbol")} style={{ cursor: "pointer" }}>
                            Symbol {sortConfig.key === "symbol" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                        </th>
                        <th onClick={() => handleSort("totalQuantity")} style={{ cursor: "pointer" }}>
                            Total Quantity {sortConfig.key === "totalQuantity" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                        </th>
                        <th onClick={() => handleSort("averagePrice")} style={{ cursor: "pointer" }}>
                            Average Price {sortConfig.key === "averagePrice" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                        </th>
                        <th onClick={() => handleSort("currentPrice")} style={{ cursor: "pointer" }}>
                            Current Price {sortConfig.key === "currentPrice" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                        </th>
                        <th onClick={() => handleSort("totalCost")} style={{ cursor: "pointer" }}>
                            Current Value {sortConfig.key === "totalCost" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                        </th>

                        <th onClick={() => handleSort("change")} style={{ cursor: "pointer" }}>
                            Change {sortConfig.key === "change" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                        </th>

                        <th onClick={() => handleSort("pChange")} style={{ cursor: "pointer" }}>
                            Change % {sortConfig.key === "pChange" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                        </th>

                        <th onClick={() => handleSort("daypandl")} style={{ cursor: "pointer" }}>
                            Day p&l {sortConfig.key === "daypandl" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                        </th>

                        <th onClick={() => handleSort("profitAndLoss")} style={{ cursor: "pointer" }}>
                            Profit/Loss {sortConfig.key === "profitAndLoss" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                        </th>
                        <th onClick={() => handleSort("netChangePercent")} style={{ cursor: "pointer" }}>
                            Net chg {sortConfig.key === "netChangePercent" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {portfolioData.map((details) => (
                        <React.Fragment key={details.symbol}>
                            {/* Main Row */}
                            <tr
                                style={{ cursor: "pointer" }}
                                onClick={() => handleRowClick(details.symbol)}
                            >
                                <td>{details.symbol}</td>
                                <td>{details.totalQuantity}</td>
                                <td>{details.averagePrice.toFixed(2)}</td>
                                <td>{details.currentPrice.toFixed(2)}</td>
                                <td>{details.totalCost.toFixed(2)}</td>

                                <td
                                    style={{
                                        color: details.change >= 0 ? "green" : "red",
                                    }}
                                >
                                    {details.change.toFixed(2)}
                                </td>

                                <td
                                    style={{
                                        color: details.pChange >= 0 ? "green" : "red",
                                    }}
                                >
                                    {details.pChange.toFixed(2)}
                                </td>

                                <td
                                    style={{
                                        color: details.daypandl >= 0 ? "green" : "red",
                                    }}
                                >
                                    {details.daypandl.toFixed(2)}
                                </td>

                               
                                <td
                                    style={{
                                        color: details.profitAndLoss >= 0 ? "green" : "red",
                                    }}
                                >
                                    {details.profitAndLoss.toFixed(2)}
                                </td>
                                <td
                                    style={{
                                        color: details.netChangePercent >= 0 ? "green" : "red",
                                    }}
                                >
                                    {details.netChangePercent.toFixed(2)}%
                                </td>
                            </tr>

                            {/* Expandable Row */}
                            <tr>
                                <td colSpan={10} className="p-0">
                                    <Collapse in={expandedRow === details.symbol}>
                                        <Box className="p-3 bg-dark">
                                            <Typography variant="h6">Transactions</Typography>
                                            {details.transactions.length > 0 ? (
                                                <Table size="sm" bordered>
                                                    <thead>
                                                        <tr>
                                                            <th>Quantity</th>
                                                            <th>Price</th>
                                                            <th>Purchase Date</th>
                                                            <th>p&l</th>
                                                            <th>Comments</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {details.transactions.map((txn, index) => (
                                                            <tr key={index} style={{ color: txn.pandl > 0 ? "green" : "red" }}>
                                                                <td>{txn.quantity}</td>
                                                                <td>{txn.price.toFixed(2)}</td>
                                                                <td>
                                                                    {new Date(txn.purchaseDate).toLocaleDateString()}
                                                                </td>
                                                                <td>{txn.pandl}</td>
                                                                <td>{txn.comments || "N/A"}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </Table>
                                            ) : (
                                                <Typography>No transactions available</Typography>
                                            )}
                                        </Box>
                                    </Collapse>
                                </td>
                            </tr>
                        </React.Fragment>
                    ))}
                </tbody>
            </Table>
        </div>
    );
};

export default PortfolioTable;
