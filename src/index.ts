import http from 'http';
import { app } from "./config/server.js";
import { initialiseSocket } from './socket/index.js';

const PORT = process.env.PORT || 3000;
const httpServer = http.createServer(app);

initialiseSocket(httpServer);

httpServer.on('error', (err) => {
  console.error("Error during server startup:", err);
  process.exit(1);
});

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
