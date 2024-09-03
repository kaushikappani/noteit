import React, { useEffect, useState } from 'react';
import { Table, Container, Row, Col, Card } from 'react-bootstrap';
import axios from 'axios';
import Header from '../components/Header';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { BoxArrowUpRight, Download } from 'react-bootstrap-icons';
import SummaryCard from '../components/SummaryCard';
import StockTable from '../components/StockTable';
// import StockDoughnutChart from '../components/StockDoughnutChart';



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
  const [indexData, setIndexData] = useState([]);  

  const fetchSummary = async () => {
    try {
      const config = {
        withCredentials: true,
      };
      setLoading(true);
      const { data } = await axios.get("/api/stock/summary", config);
      setPayload(data.payload);
      setIndexData(data.index); 
      setTotalPrice(data.total.toFixed(2));
      setWorth(data.worth.toFixed(2));
      console.log(typeof data.worth.toFixed(2))
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

  const sortedPayload = React.useMemo(() => {
    if (!sortColumn) return payload;

    return [...payload].sort((a, b) => {
      const valueA = a[sortColumn];
      const valueB = b[sortColumn];

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
      } else if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortOrder === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
      }
      return 0;
    });
  }, [payload, sortColumn, sortOrder]);


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
            <SummaryCard
              totalPrice={totalPrice}
              worth={worth}
              lastUpdate={lastUpdate}
              payload={payload}
              index={indexData} 
            />
            {/* <StockDoughnutChart
              payload={payload}
              worth={worth}
            /> */}
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



const ActionLinks = () => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px' }}>
    <a target="_blank" href={`/api/stock/data/page/report`}><BoxArrowUpRight /> Open page</a>
    <a href={`/api/stock/data/excel/report`}><Download /> Download</a>
  </div>
);

export default StockScreener;
