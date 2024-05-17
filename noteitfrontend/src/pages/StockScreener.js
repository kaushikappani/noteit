import React, { useEffect, useState } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import TableSortLabel from '@mui/material/TableSortLabel';
import io from 'socket.io-client';
import Cookies from "js-cookie";


const token = Cookies.get('token'); 

console.log(token);

const socket = io("http://localhost:5500", {
  auth: {
    token,
  }
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
  const [order, setOrder] = useState('asc');
  const [orderBy, setOrderBy] = useState('symbol');

 

  useEffect(() => {
    socket.on('totalPrice', (total) => {
      setTotalPrice(total);
    });
    socket.on('payload', (payload) => {
      setPayload(payload);
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  const handleRequestSort = (event, property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  return (
    <>
      <h1>Total P&L = {totalPrice}</h1>
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
                  % Change
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
            </TableRow>
          </TableHead>
          <TableBody>
            {stableSort(payload, getComparator(order, orderBy)).map((row) => (
              <TableRow
                key={row.symbol}
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  {row.symbol}
                </TableCell>
                <TableCell align="right">{row.currentPrice}</TableCell>
                <TableCell style={{ color: row.daypnl > 0 ? "green" : "red" }} align="right">{row.daypnl}</TableCell>
                <TableCell align="right">{row.pChange}</TableCell>
                <TableCell align="right">{row.deliveryToTradedQuantity}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
};

export default StockScreener;
