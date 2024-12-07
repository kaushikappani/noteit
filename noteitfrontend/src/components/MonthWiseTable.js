import axios from 'axios';
import React, { useEffect, useState } from 'react'

import { Table, Collapse } from 'react-bootstrap';
import { Box, Typography } from '@mui/material';


const MonthWiseTable = ({data}) => {

    const [expandedRow, setExpandedRow] = useState(null);

  
    const handleRowClick = (symbol) => {
        setExpandedRow(expandedRow === symbol ? null : symbol);
    };


  return (
    //   <div className="container">
          <Table bordered hover responsive>
              <thead>
                  <tr>
                      <th>Month</th>
                      <th>Invested</th>
                      <th>Profit</th>
                  </tr>
              </thead>
              <tbody>
                  {data && data.monthlySummary.map((details) => (
                      <React.Fragment key={details.dayKey}>
                          <tr
                              style={{ cursor: "pointer" }}
                              onClick={() => handleRowClick(details.monthKey)}
                          >
                              <td>{details.monthKey}</td>
                              <td>{details.totalInvested.toFixed(2)}</td>
                              <td
                                  style={{
                                      color: details.totalProfit >= 0 ? "green" : "red",
                                  }}
                              >{details.totalProfit.toFixed(2)}</td>
                          </tr>

                          {/* Expandable Row */}
                          <tr>
                              <td colSpan={3} className="p-0">
                                  <Collapse in={expandedRow === details.monthKey}>
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
                                                      <tr
                                                          style={{
                                                              color: transaction.profit >= 0 ? "green" : "red",
                                                          }}
                                                          key={index}>
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
    //   </div>
  )
}

export default MonthWiseTable