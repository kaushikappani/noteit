import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import MainScreen from '../components/Mainscreen';
import { Button, Card, Col, Container, Form, Row, Table, Tabs, Tab, Spinner, Accordion, Badge, Modal } from 'react-bootstrap';
import ErrorMessage from '../components/errorMessage';

const formatCurrency = (value) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const TradeBook = ({ history }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dragging, setDragging] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [showTradesModal, setShowTradesModal] = useState(false);
  const fileInputRef = useRef(null);

  const fetchAnalysis = async () => {
    try {
      setLoadingAnalysis(true);
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      if (!userInfo) {
        history.push("/");
        return;
      }
      const config = {
        headers: {
          Authorization: `Bearer ${userInfo.token}`,
        },
      };
      
      let url = "/api/tradebook/analysis";
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (startDate || endDate) url += `?${params.toString()}`;

      const { data } = await axios.get(url, config);
      setAnalysis(data);
      setLoadingAnalysis(false);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      setLoadingAnalysis(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const config = {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${userInfo.token}`,
        },
      };

      const formData = new FormData();
      formData.append("file", file);

      const { data } = await axios.post("/api/tradebook/upload", formData, config);
      setSuccess(data.message);
      setUploading(false);
      setFile(null);
      // Refresh analysis
      fetchAnalysis();
    } catch (err) {
      setUploading(false);
      setError(err.response?.data?.message || err.message);
    }
  };

  const handleFilter = (e) => {
    e.preventDefault();
    fetchAnalysis();
  }

  const renderStockWise = () => {
    if (!analysis || !analysis.stockWise) return null;
    return (
      <Table striped bordered hover responsive className="mt-3">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Buy Qty</th>
            <th>Buy Total (₹)</th>
            <th>Avg Buy Price (₹)</th>
            <th>Sell Qty</th>
            <th>Sell Total (₹)</th>
            <th>Avg Sell Price (₹)</th>
            <th>Net (₹)</th>
          </tr>
        </thead>
        <tbody>
          {analysis.stockWise.map((sw, idx) => (
            <tr 
              key={idx} 
              style={{ cursor: 'pointer' }} 
              onClick={() => {
                setSelectedStock(sw.symbol);
                setShowTradesModal(true);
              }}
              title="Click to view all trades for this stock"
            >
              <td style={{ color: '#007bff', fontWeight: 'bold' }}>{sw.symbol}</td>
              <td>{sw.buyQty}</td>
              <td>{formatCurrency(sw.buyTotal)}</td>
              <td>{formatCurrency(sw.averageBuyPrice)}</td>
              <td>{sw.sellQty}</td>
              <td>{formatCurrency(sw.sellTotal)}</td>
              <td>{formatCurrency(sw.averageSellPrice)}</td>
              <td style={{ fontWeight: 'bold', color: (sw.buyTotal - sw.sellTotal) > 0 ? 'green' : 'inherit' }}>
                {formatCurrency(sw.buyTotal - sw.sellTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  };

  const renderPeriodic = (dataArray, keyName, title) => {
    if (!dataArray || dataArray.length === 0) return <p>No data available</p>;
    return (
      <Accordion className="mt-3">
        {dataArray.map((item, idx) => (
          <Card key={idx} className="mb-2 shadow-sm border-0">
            <Accordion.Toggle as={Card.Header} eventKey={idx.toString()} style={{ cursor: 'pointer', backgroundColor: '#343a40', color: 'white' }}>
              <div className="d-flex justify-content-between align-items-center w-100">
                <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{title}: {item[keyName]}</span>
                <div>
                  <Badge variant="success" className="mr-2" style={{ fontSize: '0.9rem', padding: '8px 12px' }}>
                    Total Invested: ₹{formatCurrency(item.buyAmount)}
                  </Badge>{' '}
                  <Badge variant="danger" className="mr-2" style={{ fontSize: '0.9rem', padding: '8px 12px' }}>
                    Total Sold: ₹{formatCurrency(item.sellAmount)}
                  </Badge>{' '}
                  <Badge variant="primary" style={{ fontSize: '0.9rem', padding: '8px 12px' }}>
                    Net: ₹{formatCurrency(item.buyAmount - item.sellAmount)}
                  </Badge>
                </div>
              </div>
            </Accordion.Toggle>
            <Accordion.Collapse eventKey={idx.toString()}>
              <Card.Body style={{ padding: 0 }}>
                <Table striped bordered hover responsive size="sm" className="mb-0">
                  <thead className="thead-dark">
                    <tr>
                      <th>Symbol</th>
                      <th>Buy Qty</th>
                      <th>Avg Buy Price (₹)</th>
                      <th>Total Buy (₹)</th>
                      <th>Sell Qty</th>
                      <th>Avg Sell Price (₹)</th>
                      <th>Total Sell (₹)</th>
                      <th>Net (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(item.stocks).map(([sym, details]) => (
                      <tr key={sym}>
                        <td style={{ fontWeight: 'bold' }}>{sym}</td>
                        <td className="text-success">{details.buyQty}</td>
                        <td className="text-success">{details.averageBuyPrice ? formatCurrency(details.averageBuyPrice) : '0.00'}</td>
                        <td className="text-success">{details.buyTotal ? formatCurrency(details.buyTotal) : '0.00'}</td>
                        <td className="text-danger">{details.sellQty}</td>
                        <td className="text-danger">{details.averageSellPrice ? formatCurrency(details.averageSellPrice) : '0.00'}</td>
                        <td className="text-danger">{details.sellTotal ? formatCurrency(details.sellTotal) : '0.00'}</td>
                        <td style={{ fontWeight: 'bold' }}>{formatCurrency((details.buyTotal || 0) - (details.sellTotal || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Accordion.Collapse>
          </Card>
        ))}
      </Accordion>
    );
  };

  return (
    <MainScreen title="Trade Book Analysis">
      <Container>
        {error && <ErrorMessage variant="danger">{error}</ErrorMessage>}
        {success && <ErrorMessage variant="success">{success}</ErrorMessage>}
        
        <Card className="mb-4">
          <Card.Header>Upload Trade Book (CSV)</Card.Header>
          <Card.Body>
            <Form onSubmit={handleUpload}>
              <div 
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
                style={{
                  border: dragging ? '2px dashed #007bff' : '2px dashed #6c757d',
                  borderRadius: '10px',
                  padding: '40px',
                  textAlign: 'center',
                  backgroundColor: dragging ? 'rgba(0, 123, 255, 0.1)' : 'transparent',
                  transition: 'background-color 0.3s, border-color 0.3s',
                  marginBottom: '20px',
                  cursor: 'pointer'
                }}
              >
                <Form.Group controlId="formFile">
                  <Form.Label style={{ cursor: 'pointer', fontSize: '1.2rem', margin: 0, fontWeight: '500' }}>
                    {file ? <strong>Selected File: {file.name}</strong> : 'Drag & Drop your CSV file here, or click to select'}
                  </Form.Label>
                  <Form.Control 
                    type="file" 
                    accept=".csv" 
                    onChange={handleFileChange} 
                    className="mt-2" 
                    ref={fileInputRef}
                    style={{ display: 'none' }} 
                  />
                </Form.Group>
              </div>
              <Button type="submit" variant="primary" disabled={uploading || !file}>
                {uploading ? <Spinner animation="border" size="sm" /> : "Upload and Sync"}
              </Button>
            </Form>
          </Card.Body>
        </Card>

        <Card className="mb-4">
          <Card.Header>Filter Analysis by Date (Fixed Period)</Card.Header>
          <Card.Body>
            <Form onSubmit={handleFilter}>
              <Row>
                <Col md={4}>
                  <Form.Group controlId="startDate">
                    <Form.Label>Start Date</Form.Label>
                    <Form.Control type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group controlId="endDate">
                    <Form.Label>End Date</Form.Label>
                    <Form.Control type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </Form.Group>
                </Col>
                <Col md={4} className="d-flex align-items-end">
                  <Button type="submit" variant="success" className="w-100 mt-3">Apply Filter</Button>
                </Col>
              </Row>
            </Form>
          </Card.Body>
        </Card>

        {loadingAnalysis ? (
          <div className="d-flex justify-content-center mt-5"><Spinner animation="border" /></div>
        ) : (
          <Tabs defaultActiveKey="stockwise" id="analysis-tabs" className="mb-3">
            <Tab eventKey="stockwise" title="Stock-wise Analysis">
              {renderStockWise()}
            </Tab>
            <Tab eventKey="monthly" title="Monthly Analysis">
              {renderPeriodic(analysis?.monthly, 'month', 'Month')}
            </Tab>
            <Tab eventKey="yearly" title="Yearly Analysis">
              {renderPeriodic(analysis?.yearly, 'year', 'Year')}
            </Tab>
            <Tab eventKey="daily" title="Daily Analysis">
              {renderPeriodic(analysis?.daily, 'day', 'Day')}
            </Tab>
          </Tabs>
        )}

        <Modal show={showTradesModal} onHide={() => setShowTradesModal(false)} size="lg" centered contentClassName="bg-dark text-light border-0 shadow-lg" style={{ borderRadius: '15px', overflow: 'hidden' }}>
          <Modal.Header className="border-bottom-0 pb-0 pt-4 px-4">
            <Modal.Title style={{ fontWeight: '600', letterSpacing: '0.5px' }}>
              Trade History: <span className="text-info">{selectedStock}</span>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="px-4 py-3" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {selectedStock && analysis?.allTrades && (
              <Table borderless hover responsive size="sm" variant="dark" className="mb-0" style={{ backgroundColor: 'transparent' }}>
                <thead style={{ borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                  <tr>
                    <th className="text-muted font-weight-normal pb-2">Date</th>
                    <th className="text-muted font-weight-normal pb-2">Type</th>
                    <th className="text-muted font-weight-normal pb-2">Qty</th>
                    <th className="text-muted font-weight-normal pb-2">Price (₹)</th>
                    <th className="text-muted font-weight-normal pb-2">Total (₹)</th>
                    <th className="text-muted font-weight-normal pb-2">Order ID</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.allTrades
                    .filter(t => t.symbol === selectedStock)
                    .sort((a, b) => new Date(b.trade_date) - new Date(a.trade_date))
                    .map((trade, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td className="py-2 align-middle">{new Date(trade.trade_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td className="py-2 align-middle">
                          <span style={{ 
                            backgroundColor: trade.trade_type.toLowerCase() === 'buy' ? 'rgba(40, 167, 69, 0.2)' : 'rgba(220, 53, 69, 0.2)',
                            color: trade.trade_type.toLowerCase() === 'buy' ? '#28a745' : '#dc3545',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            fontSize: '0.75rem',
                            letterSpacing: '1px'
                          }}>
                            {trade.trade_type}
                          </span>
                        </td>
                        <td className="py-2 align-middle">{trade.quantity}</td>
                        <td className="py-2 align-middle">{formatCurrency(trade.price)}</td>
                        <td className="py-2 align-middle font-weight-bold">{formatCurrency(trade.quantity * trade.price)}</td>
                        <td className="py-2 align-middle text-muted" style={{ fontSize: '0.85rem' }}>{trade.order_id}</td>
                      </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Modal.Body>
          <Modal.Footer className="border-top-0 pt-0 pb-4 px-4">
            <Button variant="outline-light" onClick={() => setShowTradesModal(false)} className="px-4 rounded-pill" style={{ fontWeight: '500' }}>
              Done
            </Button>
          </Modal.Footer>
        </Modal>

      </Container>
    </MainScreen>
  );
};

export default TradeBook;
