import React, { useEffect, useState } from 'react'
import Header from '../components/Header'
import Notification from '../components/Notification'
import { Col, Container, Row } from 'react-bootstrap';
import AddExpense from '../components/AddExpense';
import { PlusCircle } from 'react-bootstrap-icons';
import AddStock from '../components/AddStock';
import PortfolioTable from '../components/PortfolioTable';
import StockIndexCards from '../components/StockIndexCards';
import axios from 'axios';
import SummaryCardV2 from '../components/SummaryCardv2';
import DayWiseTable from '../components/DayWiseTable';
import MonthWiseTable from '../components/MonthWiseTable';

const Portfolio = () => {
    const [alert, setAlert] = useState({
        open: false,
        type: "",
        message: ""
    });

    const [reloadStockDataCallback, setReloadStockDataCallback] = useState(false);
    const [portfolioData, setPortfolioData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [summary, setSummary] = useState({
        currentValue: "",
        daypandl: "",
        topGainer: "",
        topLoser : ""
    })
    const [data, setData] = useState();


    const buttonStyle = {
        borderRadius: "100%",
        height: "60px",
        width: "60px",
        float: "right",
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: "1000",
    };

    const fetchData = async () => {
        const { data } = await axios.get("/api/stock/v2/portfolio/summary");

        setData(data);
    }

    useEffect(() => {
        const fetchPortfolioData = async () => {
            try {
                const response = await axios.get("/api/stock/v2/portfolio");
                setSummary(response.data.overall)
                const formattedData = Object.entries(response.data.groupedPortfolio).map(([symbol, details]) => ({
                    symbol,
                    ...details,
                }));
                setPortfolioData(formattedData);
                setLoading(false);
            } catch (err) {
                setError(err.message);
                setLoading(false);
            }
        };

        fetchPortfolioData();
        fetchData();
    }, []);

    return (
        <div>
            <Notification alert={alert} setAlert={setAlert} />
            <Container>
                <Header />

                <Row>

                    <Col xs={12} md={4}>
                        {summary && (<SummaryCardV2 summary={summary} />)}
                        <DayWiseTable data={data} />
                        <MonthWiseTable data = {data} />
                    </Col>

                    

                    <Col xs={12} md={8}>
                        <StockIndexCards reloadStockData={reloadStockDataCallback} />
                        <PortfolioTable portfolioData={portfolioData} setPortfolioData={setPortfolioData} loading={loading} error = {error} />
                    </Col>
                </Row>

                <button style={buttonStyle} className="btn btn-success">
                    <AddStock fetchExpenses={""}>
                        <PlusCircle />
                    </AddStock>
                </button>
                
            </Container>
        </div>
    )
}

export default Portfolio;
