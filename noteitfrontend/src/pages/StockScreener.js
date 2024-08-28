import React, { useEffect, useState } from 'react';
import { Table } from 'react-bootstrap';
import axios from 'axios';
import Header from '../components/Header';
import { Container, Row, Col } from 'react-bootstrap';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { BoxArrowUpRight } from 'react-bootstrap-icons';
import { Download } from 'react-bootstrap-icons';

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

  const fetchSummary = async () => {
    try {
      const config = {
        withCredentials: true,
      };
      setLoading(true);
      const { data } = await axios.get("/api/stock/summary", config);
      setPayload(data.payload);
      setTotalPrice(data.total);
      setWorth(data.worth);
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
    return () => clearInterval(intervalId);
  }, [autoReload]);

  const handleAutoReloadToggle = () => {
    setAutoReload(prev => !prev);
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Header page="stocks" fetchSummary={fetchSummary} loading={loading} autoReload={autoReload} handleAutoReloadToggle={handleAutoReloadToggle} />
      <Container fluid>
        <Row>
          <Col xs={12} md={4}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px' }}>
              <h3>Total Price: {totalPrice.toFixed(2)}</h3>
              <h3>Worth: {worth.toFixed(2)}</h3>
            </div>
          </Col>
          <Col xs={12} md={8}>
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th align="right">Current Price</th>
                  <th align="right">Day P&L</th>
                  <th align="right">Change</th>
                  <th align="right">Delivery to Traded Quantity</th>
                  <th align="right">Current Value</th>
                  <th align="right">Sector PE</th>
                  <th align="right">PE</th>
                </tr>
              </thead>
              <tbody>
                {payload.map((row) => (
                  <tr key={row.symbol}>
                    <td><a target="_blank" href={`/api/stock/data/ai/report/${row.symbol}`}>{row.symbol}</a></td>
                    <td align="right">{row.currentPrice.toFixed(2)}</td>
                    <td style={{ color: row.daypnl >= 0 ? "green" : "red" }} align="right">{row.daypnl.toFixed(2)}</td>
                    <td style={{ color: row.pChange >= 0 ? "green" : "red" }} align="right">{row.change.toFixed(2)} , {row.pChange.toFixed(2)} % </td>
                    <td style={{ color: row.deliveryToTradedQuantity >= 40 ? "green" : "red" }} align="right">{row.deliveryToTradedQuantity.toFixed(2)}</td>
                    <td align="right">{row.currentValue.toFixed(2)}</td>
                    <td align="right">{row.pdSectorPe}</td>
                    <td align="right">{row.pdSymbolPe}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px' }}>
              <a target="_blank" href={`/api/stock/data/page/report`}><BoxArrowUpRight /> Open page</a>
              <a href={`/api/stock/data/excel/report`}><Download /> Download</a>
            </div>
          </Col>
        </Row>
      </Container>
    </ThemeProvider>
  );
};

export default StockScreener;