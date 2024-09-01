const { Card } = require("react-bootstrap");

const SummaryCard = ({ totalPrice, worth, lastUpdate, payload, index }) => {
    let sortedPayload = [];

    if (payload) {
        sortedPayload = payload.sort((a, b) => b.daypnl - a.daypnl);
    }

    worth = parseFloat(worth);
    totalPrice = parseFloat(totalPrice);

    const isPositive = (value) => value >= 0;
    const totalPricePercent = ((totalPrice / worth) * 100).toFixed(2);

    // Function to format numbers with commas
    const formatNumber = (num) => {
        return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <Card className="summary-card">
            <Card.Body>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #444', fontSize: '12px' }}>
                    {index.map((item) => (
                        <div key={item.symbol} style={{ marginRight: '15px', textAlign: 'center' }}>
                            <div style={{ color: '#BBBBBB', fontSize: '12px' }}><strong>{item.symbol === "^NSEI" ? "NIFTY 50" : "NIFTY BANK"}</strong></div>
                            <div style={{ color: 'green', fontSize: '16px' }}>
                                {formatNumber(item.currentPrice)} <span style={{ fontSize: '12px', color: '#BBBBBB' }}>({(item.pChange * 100).toFixed(2)}%)</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', fontSize: '12px' }}>
                    <div>
                        <div style={{ color: '#BBBBBB' }}><strong>Current Value</strong></div>
                        <div style={{ marginTop: '5px', fontSize: '18px' }}>{formatNumber(worth)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#BBBBBB' }}><strong>Day P&L</strong></div>
                        <div style={{ marginTop: '5px', color: isPositive(totalPrice) ? 'green' : 'red', fontSize: '18px' }}>
                            {formatNumber(totalPrice)} <span style={{ fontSize: '12px' }}>({totalPricePercent}%)</span>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', fontSize: '12px' }}>
                    <div>
                        <div style={{ color: '#BBBBBB' }}><strong>Top gainer</strong></div>
                        <div style={{ marginTop: '5px', color: 'green' }}>
                            {sortedPayload[0] ? sortedPayload[0].symbol : "..."} <span style={{ fontSize: "12px" }} >({sortedPayload[0] ? sortedPayload[0].pChange.toFixed(2) : "..."}%)</span>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#BBBBBB' }}><strong>Top loser</strong></div>
                        <div style={{ marginTop: '5px', color: 'red' }}>
                            {sortedPayload[sortedPayload.length - 1] ? sortedPayload[sortedPayload.length - 1].symbol : "..."} <span style={{ fontSize: "12px" }}>({sortedPayload[sortedPayload.length - 1] ? sortedPayload[sortedPayload.length - 1].pChange.toFixed(2) : "..."}%)</span>
                        </div>
                    </div>
                </div>
                <small style={{ marginTop: '15px', display: 'block', fontSize: '13px' }}>Last Update: {lastUpdate.toLocaleTimeString()}</small>
            </Card.Body>
        </Card>
    );
};

export default SummaryCard;
