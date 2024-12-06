import axios from 'axios';
import React, { useEffect, useState } from 'react'

import { Table, Collapse } from 'react-bootstrap';
import { Box, Typography } from '@mui/material';


const DayWiseTable = () => {

    const [expandedRow, setExpandedRow] = useState(null);
    const [data, setData] = useState();

    const fetchData = async() => { 
        const { data } = await axios.get("/api/stock/v2/portfolio/summary");
        
        setData(data);
    }
    const handleRowClick = (symbol) => {
        setExpandedRow(expandedRow === symbol ? null : symbol);
    };

    useEffect(() => {
        fetchData();
    },[])

  return (
      <div className="container mt-4">
          <Table bordered hover responsive>
              <thead>
                  <tr>
                      <th>Day</th>
                      <th>Invested</th>
                      <th>Profit</th>
                  </tr>
              </thead>
              <tbody>
                  {data && data.dailySummary.map((details) => (
                      <React.Fragment key={details.dayKey}>
                          <tr
                              style={{ cursor: "pointer" }}
                              onClick={() => handleRowClick(details.dayKey)}
                          >
                              <td>{details.dayKey}</td>
                              <td>{details.totalInvested.toFixed(2)}</td>
                              <td>{details.totalProfit.toFixed(2)}</td>
                          </tr>

                          {/* Expandable Row */}
                          <tr>
                              <td colSpan={3} className="p-0">
                                  <Collapse in={expandedRow === details.dayKey}>
                                      <Box className="p-3 bg-dark">
                                          <Typography variant="h6">Transactions</Typography>
                                          <Table size="sm" bordered>
                                              <thead>
                                                  <tr>
                                                      <th>Symbol</th>
                                                      <th>Quantity</th>
                                                      <th>Price</th>
                                                      <th>InvestedAmount</th>
                                                      <th>Profit</th>
                                                  </tr>
                                              </thead>
                                              <tbody>
                                                  {details.transactions && details.transactions.map((transaction, index) => (
                                                      <tr key={index}>
                                                          <td>{transaction.symbol}</td>
                                                          <td>{transaction.quantity}</td>
                                                          <td>{transaction.price.toFixed(2)}</td>
                                                          <td>{transaction.investedAmount.toFixed(2)}</td>
                                                          <td>{transaction.profit.toFixed(2)}</td>
                                                      </tr>
                                                  ))}
                                              </tbody>
                                          </Table>
                                      </Box>
                                  </Collapse>
                              </td>
                          </tr>
                      </React.Fragment>
                  ))}
              </tbody>
          </Table>
      </div>
  )
}

export default DayWiseTable