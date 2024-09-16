import React from 'react'
import { Table } from 'react-bootstrap';

const StockTable = ({ sortedPayload, handleSort, renderSortSymbol }) => (
    <Table striped bordered hover responsive>
        <thead>
            <tr>
                <th onClick={() => handleSort('symbol')}>Symbol{renderSortSymbol('symbol')}</th>
                <th onClick={() => handleSort('currentPrice')} align="right">Current Price{renderSortSymbol('currentPrice')}</th>
                <th onClick={() => handleSort('daypnl')} align="right">Day P&L{renderSortSymbol('daypnl')}</th>
                <th onClick={() => handleSort('change')} align="right">Change{renderSortSymbol('change')}</th>
                <th onClick={() => handleSort('currentValue')} align="right">Current Value{renderSortSymbol('currentValue')}</th>
                <th onClick={() => handleSort('pdSymbolPe')} align="right">PE{renderSortSymbol('pdSymbolPe')}</th>
                <th align='right'>Delivery</th>
                <th align="right">Rating</th>
            </tr>
        </thead>
        <tbody>
            {sortedPayload.map((row) => (
                <tr key={row.symbol}>
                    <td><a target="_blank" href={`/api/stock/data/ai/report/${row.symbol}`}>{row.symbol} ({row.quantity}) </a></td>
                    <td align="right">{row.currentPrice.toFixed(2)}</td>
                    <td style={{ color: row.daypnl >= 0 ? "green" : "red" }} align="right">{row.daypnl.toFixed(2)}</td>
                    <td style={{ color: row.pChange >= 0 ? "green" : "red" }} align="right">{row.change.toFixed(2)} , {row.pChange.toFixed(2)} % </td>
                    <td align="right">{row.currentValue.toFixed(2)}</td>
                    <td align="right">{row.pdSymbolPe ? row.pdSymbolPe.toFixed(2) : '-'}</td>
                    <td align='right'>{row.deliveryData}</td>
                    <td align="right">{row.rating ? row.rating : '-'}</td>
                </tr>
            ))}
        </tbody>
    </Table>
);

export default StockTable