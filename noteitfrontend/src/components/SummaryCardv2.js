import React from 'react';
import { Card, Row, Col } from 'react-bootstrap';

const SummaryCardV2 = ({ summary }) => {
    const { currentValue, totalDayPAndL, topGainer, topLoser } = summary;

    const formatCurrency = (value) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);

    return (
        <Card style={{ margin: "20px 0", padding: "20px", borderRadius: "10px" }}>
            <Card.Body>
                <Row>
                    <Col xs={6}>
                        <h5>Worth</h5>
                        <p>{formatCurrency(currentValue)}</p>
                    </Col>
                    <Col style={{textAlign:"right"}} xs={6} >
                        <h5>Total Day P&L</h5>
                        <p style={{ color: totalDayPAndL >= 0 ? "green" : "red" }}>
                            {formatCurrency(totalDayPAndL)}
                        </p>
                    </Col>
                </Row>
                <Row>
                    <Col xs={6}>
                        <h6>Top Gainer</h6>
                        <p>{topGainer.name} ({topGainer.percentage}%)</p>
                    </Col>
                    <Col style={{ textAlign: "right" }} xs={6}>
                        <h6>Top Loser</h6>
                        <p>{topLoser.name} ({topLoser.percentage}%)</p>
                    </Col>
                </Row>
            </Card.Body>
        </Card>
    );
};

export default SummaryCardV2;
