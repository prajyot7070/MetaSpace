import express from "express"
import { router } from "./routes/v1";
const PORT = 3000;
const app = express();
const cors = require('cors');

// Updated CORS configuration
const corsOptions = {
  origin: 'http://localhost:5173',
  credentials: true,
};

// Apply CORS before all routes
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/v1", router);

app.listen(process.env.PORT || PORT, () => {
  console.log(`Server is running at ${PORT}`)
});
