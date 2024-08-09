import React, { useEffect, useState } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import TableSortLabel from '@mui/material/TableSortLabel';
import Button from '@mui/material/Button';
import axios from 'axios';
import Header from '../components/Header';
import { Container } from 'react-bootstrap';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

function descendingComparator(a, b, orderBy) {
  if (b[orderBy] < a[orderBy]) {
    return -1;
  }
  if (b[orderBy] > a[orderBy]) {
    return 1;
  }
  return 0;
}

function getComparator(order, orderBy) {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

function stableSort(array, comparator) {
  const stabilizedThis = array.map((el, index) => [el, index]);
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });
  return stabilizedThis.map((el) => el[0]);
}

const StockScreener = () => {
  const [totalPrice, setTotalPrice] = useState(0);
  const [payload, setPayload] = useState([]);
  const [worth, setWorth] = useState(0);
  const [order, setOrder] = useState('asc');
  const [orderBy, setOrderBy] = useState('symbol');
  const [error, setError] = useState();
  const [success, setSuccess] = useState();
  const [loading, setLoading] = useState(false);
  const [autoReload, setAutoReload] = useState(false); 

  const fetchSummary = async () => {
    console.log("fetch summary");
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
    let intervalId;
    if (autoReload) {
      intervalId = setInterval(() => {
        fetchSummary();
      }, 10000);
    }
    return () => clearInterval(intervalId);
  }, [autoReload]);

  const handleRequestSort = (event, property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleAutoReloadToggle = () => {
    setAutoReload(prev => !prev);
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
          {autoReload ? 'Stop Auto-Reload' : 'Start Auto-Reload'}
      <Header page="stocks" fetchSummary={fetchSummary} loading={loading} autoReload={autoReload} handleAutoReloadToggle={handleAutoReloadToggle}  />
      <Container>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{totalPrice.toFixed(2)}</h3>
          <h3 style={{ margin: 0 }}>{worth.toFixed(2)}</h3>
        </div>
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }} aria-label="sortable table">
            <TableHead>
              <TableRow>
                <TableCell sortDirection={orderBy === 'symbol' ? order : false}>
                  <TableSortLabel
                    active={orderBy === 'symbol'}
                    direction={orderBy === 'symbol' ? order : 'asc'}
                    onClick={(event) => handleRequestSort(event, 'symbol')}
                  >
                    Symbol
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sortDirection={orderBy === 'currentPrice' ? order : false}>
                  <TableSortLabel
                    active={orderBy === 'currentPrice'}
                    direction={orderBy === 'currentPrice' ? order : 'asc'}
                    onClick={(event) => handleRequestSort(event, 'currentPrice')}
                  >
                    Current Price
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sortDirection={orderBy === 'daypnl' ? order : false}>
                  <TableSortLabel
                    active={orderBy === 'daypnl'}
                    direction={orderBy === 'daypnl' ? order : 'asc'}
                    onClick={(event) => handleRequestSort(event, 'daypnl')}
                  >
                    Day P&L
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sortDirection={orderBy === 'pChange' ? order : false}>
                  <TableSortLabel
                    active={orderBy === 'pChange'}
                    direction={orderBy === 'pChange' ? order : 'asc'}
                    onClick={(event) => handleRequestSort(event, 'pChange')}
                  >
                    Change
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sortDirection={orderBy === 'deliveryToTradedQuantity' ? order : false}>
                  <TableSortLabel
                    active={orderBy === 'deliveryToTradedQuantity'}
                    direction={orderBy === 'deliveryToTradedQuantity' ? order : 'asc'}
                    onClick={(event) => handleRequestSort(event, 'deliveryToTradedQuantity')}
                  >
                    Delivery to Traded Quantity
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sortDirection={orderBy === 'currentValue' ? order : false}>
                  <TableSortLabel
                    active={orderBy === 'currentValue'}
                    direction={orderBy === 'currentValue' ? order : 'asc'}
                    onClick={(event) => handleRequestSort(event, 'currentValue')}
                  >
                    Current currentValue
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sortDirection={orderBy === 'pdSectorPe' ? order : false}>
                  <TableSortLabel
                    active={orderBy === 'pdSectorPe'}
                    direction={orderBy === 'pdSectorPe' ? order : 'asc'}
                    onClick={(event) => handleRequestSort(event, 'pdSectorPe')}
                  >
                    Sector PE
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sortDirection={orderBy === 'pdSymbolPe' ? order : false}>
                  <TableSortLabel
                    active={orderBy === 'pdSymbolPe'}
                    direction={orderBy === 'pdSymbolPe' ? order : 'asc'}
                    onClick={(event) => handleRequestSort(event, 'pdSymbolPe')}
                  >
                    PE
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stableSort(payload, getComparator(order, orderBy)).map((row) => (
                <TableRow
                  key={row.symbol}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell component="th" scope="row">
                    <a href={`/api/stock/data/ai/report/${row.symbol}`}>{row.symbol}</a> 
                  </TableCell>
                  <TableCell align="right">{row.currentPrice.toFixed(2)}</TableCell>
                  <TableCell style={{ color: row.daypnl >= 0 ? "green" : "red" }} align="right">{row.daypnl.toFixed(2)}</TableCell>
                  <TableCell style={{ color: row.pChange >= 0 ? "green" : "red" }} align="right">{row.change.toFixed(2)} , {row.pChange.toFixed(2)} % </TableCell>
                  <TableCell style={{ color: row.deliveryToTradedQuantity >= 40 ? "green" : "red" }} align="right">{row.deliveryToTradedQuantity.toFixed(2)}</TableCell>
                  <TableCell align="right">{row.currentValue.toFixed(2)}</TableCell>
                  <TableCell align="right">{row.pdSectorPe}</TableCell>
                  <TableCell align="right">{row.pdSymbolPe}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Container>
    </ThemeProvider>
  );
};

export default StockScreener;
