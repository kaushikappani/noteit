import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const StockDoughnutChart = ({ payload, worth }) => {
    const data = {
        labels: payload.map(stock => stock.symbol),
        datasets: [
            {
                label: 'Stock Contribution',
                data: payload.map(stock => (stock.currentValue / worth) * 100), 
                backgroundColor: [
                    "#0059C0",
                    "#688ED8",
                    "#9BB3E5",
                    "#017BB6",
                    "#008F7A",
                    "#41AC9C",
                    "#7EC7BC",
                    "#AA95DB",
                    "#AA95DB",
                    "#A660C5",
                    "#A660C5",
                    "#FECEC5",
                    "#FFF1DE",
                    "#AA95DB",
                    "#734FC2",
                    "#A660C5",
                    "#C270C8",
                    "#FC9AC0",
                    "#FFF1DE",
                    "#FFF1DE"
                ],
                hoverBackgroundColor: [
                    "#0059C0",
                    "#688ED8",
                    "#9BB3E5",
                    "#017BB6",
                    "#008F7A",
                    "#41AC9C",
                    "#7EC7BC",
                    "#AA95DB",
                    "#AA95DB",
                    "#A660C5",
                    "#A660C5",
                    "#FECEC5",
                    "#FFF1DE",
                    "#AA95DB",
                    "#734FC2",
                    "#A660C5",
                    "#C270C8",
                    "#FC9AC0",
                    "#FFF1DE",
                    "#FFF1DE"
                ],

                borderWidth: 0,

            },
        ],
    };

    const options = {
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                enabled: true, 
            },
        },
        cutout: '70%',
    };

    return <Doughnut data={data} options={options} />;
};

export default StockDoughnutChart;
