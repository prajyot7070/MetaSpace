import express from "express"
import { router } from "./routes/v1";
const PORT = 3000;
const app = express();

app.use("/api/v1", router);


app.listen(process.env.PORT || PORT, () => {
  console.log(`Server is running at ${PORT}`)
});
