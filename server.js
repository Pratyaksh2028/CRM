/**
 * CRM Backend Microservice Architecture
 * Central Orchestration Gateway & App Bootstrapper
 */

const express = require("express");
const cors = require("cors");
const db = require("./config/db"); // Your centralized DB connection pool
require("dotenv").config();

const app = express();

// Global Middleware Config 
app.use(express.json());
app.use(cors());

// Modular Routing Pipeline Mounting
app.use("/", require("./routes/auth"));
app.use("/users", require("./routes/users"));
app.use("/customers", require("./routes/customers"));
app.use("/leads", require("./routes/leads"));
app.use("/notes", require("./routes/notes"));

// Global 404 Fallback Route Handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// App Bootloader Portal Listening Framework
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  try {
    // Structural pre-flight verify step checking infrastructure connectivity
    await db.query("SELECT 1");
    console.log("==========================================");
    console.log("  Connected securely to MySQL database.   ");
    console.log(`  Server running on http://localhost:${PORT} `);
    console.log("==========================================");
  } catch (error) {
    console.error("Critical: Database connection failed!", error.message);
    process.exit(1); // Hard terminate process on runtime infrastructure disconnect
  }
});