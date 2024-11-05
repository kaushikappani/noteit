import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, Container, Spinner } from 'react-bootstrap';
import { Chip } from '@mui/material';
import './css/StockIndexCards.css'; // Custom CSS
import { ArrowDownCircleFill, ArrowUpCircleFill, Clock, ClockFill } from 'react-bootstrap-icons';

const StockIndexCards = ({ reloadStockData }) => {
    const [indianStocks, setIndianStocks] = useState([]);
    const [usStocks, setUsStocks] = useState([]);
    const [selectedStockType, setSelectedStockType] = useState('indian'); 
    const [loading, setLoading] = useState(true); // Loading state
    const [error, setError] = useState(false);

    
    // Fetch stock data using axios
    const fetchStockData = async () => {
        try {
            const response = await axios.get('/api/stock/index');
            console.log(response);
            setIndianStocks(response.data.indian); 
            setUsStocks(response.data.us);
            if (response.data &&  response.data.us[0].marketState === "REGULAR") {
                setSelectedStockType('us');
            }
        } catch (error) {
            console.error('Error fetching stock data:', error);
            setError(true);
        } finally {
            setLoading(false); 
        }
    };
    useEffect(() => {
        if (reloadStockData) {
            fetchStockData();
        }
        fetchStockData();
    }, [reloadStockData]);

    const displayedStocks = selectedStockType === 'indian' ? indianStocks : usStocks;

    return (
        <Container fluid>
            <div className="text-left my-3">
                {(!loading && !error ) && (
                    <>
                        <Chip
                            label="Indian Stocks"
                            variant={selectedStockType === 'indian' ? 'filled' : 'outlined'}
                            onClick={() => setSelectedStockType('indian')}
                            color={selectedStockType === 'indian' ? 'primary' : 'default'}
                            className="me-2"
                            style={{ color: 'white' }}
                        />
                        <Chip
                            label="US Stocks"
                            variant={selectedStockType === 'us' ? 'filled' : 'outlined'}
                            onClick={() => setSelectedStockType('us')}
                            color={selectedStockType === 'us' ? 'primary' : 'default'}
                            style={{ color: 'white' }}
                        />
                    </>
                )}
            </div>
            <div className="scrollable-container">
                {loading ? (
                    <div className="d-flex justify-content-center">
                        <Spinner animation="border" variant="primary" />
                    </div>
                ) : (
                    <div className="card-row"> 
                        {displayedStocks.map((stock, index) => (
                            <Card key={index} className={`stock-card ${stock.regularMarketChangePercent < 0 ? 'negative-card' : 'positive-card'}`}>
                                <Card.Body className="p-1 d-flex align-items-center">
                                    <div className="card-icon me-2">
                                        {stock.marketState != 'REGULAR' ? (
                                            <Clock className='text-danger' />

                                        ) : (
                                        <ClockFill />

                                        )}
                                    </div>
                                    <div className="card-info flex-grow-1">
                                        <Card.Title className="stock-name mb-0">{stock.shortName}</Card.Title>
                                        <div className="card-details d-flex justify-content-between">
                                            <span className={`price ${stock.regularMarketChangePercent < 0 ? 'text-danger' : 'text-success'}`}>
                                                {stock.regularMarketPrice.toFixed(2)}
                                            </span>
                                            <span className={`change ${stock.regularMarketChangePercent < 0 ? 'text-danger' : 'text-success'}`}>
                                                {stock.regularMarketChangePercent.toFixed(2)}%
                                            </span>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </Container>
    );
};

export default StockIndexCards;
