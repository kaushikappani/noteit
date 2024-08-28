import React, { useEffect, useState } from 'react';
import { Table, Container, Row, Col, Card } from 'react-bootstrap';
import axios from 'axios';
import Header from '../components/Header';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { BoxArrowUpRight, Download } from 'react-bootstrap-icons';


const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

const StockScreener = () => {
  const [totalPrice, setTotalPrice] = useState(0);
  const [payload, setPayload] = useState([]);
  const [worth, setWorth] = useState(0);
  const [error, setError] = useState();
  const [success, setSuccess] = useState();
  const [loading, setLoading] = useState(false);
  const [autoReload, setAutoReload] = useState(false);
  const [sortColumn, setSortColumn] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc');
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const fetchSummary = async () => {
    try {
      const config = {
        withCredentials: true,
      };
      setLoading(true);
      const { data } = await axios.get("/api/stock/summary", config);
      setPayload(data.payload);
      setTotalPrice(data.total.toFixed(2));
      setWorth(data.worth.toFixed(2));
      setLastUpdate(new Date());
      setLoading(false);
    } catch (e) {
      setLoading(false);
      setError(e.response ? e.response.data.message : e.message);
    }
  };

  useEffect(() => {
    fetchSummary();
    window.addEventListener('focus', fetchSummary);
    let intervalId;
    if (autoReload) {
      intervalId = setInterval(() => {
        fetchSummary();
      }, 10000);
    }
    return () => {
      window.removeEventListener('focus', fetchSummary);
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoReload]);

  const handleAutoReloadToggle = () => {
    setAutoReload(prev => !prev);
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortOrder('asc');
    }
  };

  const sortedPayload = payload.sort((a, b) => {
    if (sortColumn) {
      const valueA = a[sortColumn];
      const valueB = b[sortColumn];

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
      } else if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortOrder === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
      }
    }
    return 0;
  });

  const renderSortSymbol = (column) => {
    if (sortColumn === column) {
      return sortOrder === 'asc' ? ' ↑' : ' ↓';
    }
    return null;
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Header
        page="stocks"
        fetchSummary={fetchSummary}
        loading={loading}
        autoReload={autoReload}
        handleAutoReloadToggle={handleAutoReloadToggle}
      />
      <Container fluid>
        <Row>
          <Col xs={12} md={4}>
            <SummaryCard totalPrice={totalPrice} worth={worth} lastUpdate={lastUpdate} />
          </Col>
          <Col xs={12} md={8}>
            <StockTable
              sortedPayload={sortedPayload}
              handleSort={handleSort}
              renderSortSymbol={renderSortSymbol}
            />
            <ActionLinks />
          </Col>
        </Row>
      </Container>
    </ThemeProvider>
  );
};

const SummaryCard = ({ totalPrice, worth, lastUpdate }) => {
  const isPositive = (value) => value >= 0;
  const totalPricePercent = ((totalPrice / worth) * 100).toFixed(2);

  return (
    <Card className="summary-card">
      <Card.Body>
        <Card.Title>Summary</Card.Title>
        <Card.Text>
          <strong>P&L: </strong>
          <span style={{ color: isPositive(totalPrice) ? 'green' : 'red' }}>
            {totalPrice} ({totalPricePercent}%)
          </span>
          <br />
          <strong>Total Worth: </strong>
          <span>
            {worth}
          </span>
          <br />
          <small>Last Update: {lastUpdate.toLocaleTimeString()}</small>
        </Card.Text>
      </Card.Body>
    </Card>
  );
};
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
        <th onClick={() => handleSort('rating')} align="right">Rating{renderSortSymbol('rating')}</th>
      </tr>
    </thead>
    <tbody>
      {sortedPayload.map((row) => (
        <tr key={row.symbol}>
          <td><a target="_blank" href={`/api/stock/data/ai/report/${row.symbol}`}>{row.symbol}</a></td>
          <td align="right">{row.currentPrice.toFixed(2)}</td>
          <td style={{ color: row.daypnl >= 0 ? "green" : "red" }} align="right">{row.daypnl.toFixed(2)}</td>
          <td style={{ color: row.pChange >= 0 ? "green" : "red" }} align="right">{row.change.toFixed(2)} , {row.pChange.toFixed(2)} % </td>
          <td align="right">{row.currentValue.toFixed(2)}</td>
          <td align="right">{row.pdSymbolPe ? row.pdSymbolPe.toFixed(2) : '-'}</td>
          <td align="right">{row.rating ? row.rating : '-'}</td>
        </tr>
      ))}
    </tbody>
  </Table>
);

const ActionLinks = () => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px' }}>
    <a target="_blank" href={`/api/stock/data/page/report`}><BoxArrowUpRight /> Open page</a>
    <a href={`/api/stock/data/excel/report`}><Download /> Download</a>
  </div>
);

export default StockScreener;
