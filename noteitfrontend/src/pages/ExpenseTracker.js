import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import axios from 'axios';
import { Container, Table, Form } from 'react-bootstrap';
import { Bar, Pie } from 'react-chartjs-2';
import 'chart.js/auto';
import './Expense.css'; // Import the CSS file
import { PlusCircle, Trash } from 'react-bootstrap-icons';
import AddExpense from '../components/AddExpense';
import Notification from '../components/Notification';


const ExpenseTracker = () => {
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState();
    const [alert, setAlert] = useState({
        open: false,
        type: "",
        message: ""
    });
    const [expenses, setExpenses] = useState([]);
    const [filters, setFilters] = useState({});

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

    const fetchUser = async () => {
        setLoading(true);
        try {
            const config = { withCredentials: true };
            const { data } = await axios.get("/api/users/info", config);
            setUser(data);
        } catch (e) {
            setAlert({
                open: true,
                type: "warning",
                message: e.response ? e.response.data.message : e.message,
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            const config = { withCredentials: true };
            const { data } = await axios.get("/api/expenses", config);
            setExpenses(data);
        } catch (e) {
            setAlert({
                open: true,
                type: "warning",
                message: e.response ? e.response.data.message : e.message,
            });
        } finally {
            setLoading(false);
        }
    };

    const expRemove = async (id) => {
        setLoading(true);
        try {
            const config = { withCredentials: true };
            await axios.delete(`/api/expenses/remove/${id}`, config);
            await fetchExpenses();
            setAlert({
                open: true,
                type: "success",
                message: "Removed!"
            });
        } catch (e) {
            setAlert({
                open: true,
                type: "warning",
                message: e.response ? e.response.data.message : e.message,
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUser();
        fetchExpenses();
    }, []);

    const groupExpensesByMonth = (expenses) => {
        return expenses.reduce((acc, expense) => {
            const month = new Date(expense.date).toLocaleString('default', { month: 'long', year: 'numeric' });
            if (!acc[month]) {
                acc[month] = { total: 0, byCategory: {}, expenses: [] };
            }
            acc[month].total += expense.cost;
            acc[month].expenses.push(expense);

            if (!acc[month].byCategory[expense.category]) {
                acc[month].byCategory[expense.category] = 0;
            }
            acc[month].byCategory[expense.category] += expense.cost;

            return acc;
        }, {});
    };

    const groupedExpenses = groupExpensesByMonth(expenses);

    const categoryColors = {
        "Investments": "#4CAF50", // Green
        "Food": "#2196F3", // Blue
        "Needs": "#FFC107", // Amber
        "Wants": "#FF5722", // Deep Orange
        "Others": "#9C27B0", // Purple
    };

    const generatePieChartData = (categories) => {
        const labels = Object.keys(categories);
        const data = Object.values(categories);

        return {
            labels,
            datasets: [
                {
                    label: 'Expenses by Category',
                    data,
                    backgroundColor: labels.map(label => categoryColors[label] || '#CCCCCC'),
                    hoverBackgroundColor: labels.map(label => categoryColors[label] || '#CCCCCC'),
                },
            ],
        };
    };

    const generateBarChartData = (groupedExpenses) => {
        const months = Object.keys(groupedExpenses).reverse();
        const categories = [...new Set(expenses.map(expense => expense.category))];

        const dataset = categories.map(category => {
            return {
                label: category,
                data: months.map(month => groupedExpenses[month].byCategory[category] || 0),
                backgroundColor: categoryColors[category] || '#CCCCCC',
            };
        });

        return {
            labels: months,
            datasets: dataset,
        };
    };

    const getRowClass = (category) => {
        const color = categoryColors[category] || '#CCCCCC';
        return { backgroundColor: `${color}3F` }; // Add opacity
    };

    const handleFilterChange = (month, value) => {
        setFilters({
            ...filters,
            [month]: value,
        });
    };

    const filterExpenses = (month, expenses) => {
        const category = filters[month];
        if (!category) {
            const total = expenses.reduce((sum, expense) => sum + expense.cost, 0);
            return { filteredExpenses: expenses, total };
        }
        const filteredExpenses = expenses.filter(expense => expense.category === category);
        const total = filteredExpenses.reduce((sum, expense) => sum + expense.cost, 0);
        return { filteredExpenses, total };
    };


    return (
        <div className="expense-tracker">
            <Notification alert={alert} setAlert={setAlert} />

            <Container style={{ padding: "0px" }}>
                <Header page="expense" user={user} loading={loading} fetchNotes={fetchExpenses} />

                    {Object.keys(groupedExpenses).map(month => (
                        <div key={month} className="expense-month">
                            <h3>{month}</h3>
                            <p><strong>Total Expenses: ₹</strong> {groupedExpenses[month].total} , <strong>Spends: ₹</strong> {groupedExpenses[month].total - groupedExpenses[month].byCategory.Investments}</p>

                            {/* Category Filter Dropdown */}


                            <div className="expense-content">
                                <div className="pie-chart-container">
                                    <Pie data={generatePieChartData(groupedExpenses[month].byCategory)} options={{ responsive: true }} />
                                </div>
                                <div className="table-container">
                                    <h3>All Expenses</h3>
                                    <Table striped bordered hover responsive>
                                        <thead>
                                            <tr>
                                                <th>Description</th>
                                                <th>
                                                    <Form.Group controlId={`categoryFilter-${month}`} className="dark-theme">
                                                        <Form.Control
                                                            as="select"
                                                            value={filters[month] || ""}
                                                            onChange={(e) => handleFilterChange(month, e.target.value)}
                                                        >
                                                            <option value="">All Categories</option>
                                                            {Object.keys(categoryColors).map(category => (
                                                                <option key={category} value={category}>{category}</option>
                                                            ))}
                                                        </Form.Control>
                                                    </Form.Group>

                                                </th>
                                                <th>Cost</th>
                                                <th>Date</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filterExpenses(month, groupedExpenses[month].expenses).filteredExpenses.reverse().map(expense => (
                                                <tr key={expense._id} style={getRowClass(expense.category)}>
                                                    <td>{expense.description}</td>
                                                    <td>{expense.category}</td>
                                                    <td>₹{expense.cost}</td>
                                                    <td>{new Date(expense.date).toLocaleDateString()}</td>
                                                    <td>
                                                        <button onClick={() => expRemove(expense._id)} className="btn btn-danger btn-sm">
                                                            <Trash />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <td colSpan="2"><strong>Total</strong></td>
                                                <td><strong>₹ {filterExpenses(month, groupedExpenses[month].expenses).total}</strong></td>
                                                <td></td>
                                                <td></td>
                                            </tr>
                                        </tfoot>

                                    </Table>
                                </div>
                            </div>
                        </div>
                    ))}

                    <div className="bar-chart-container">
                        <h3>Monthly Expenses by Category</h3>
                        <Bar data={generateBarChartData(groupedExpenses)} options={{ responsive: true }} />
                    </div>

                    <button style={buttonStyle} className="btn btn-success">
                        <AddExpense fetchExpenses={fetchExpenses}>
                            <PlusCircle />
                        </AddExpense>
                    </button>
            </Container>
        </div>
    );
};

export default ExpenseTracker;
