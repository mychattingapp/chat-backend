const PORT = process.env.PORT || 3000;
const app = require("./config/server");

(async () => {
  try {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  }
  catch (err) {
    console.error("Error during server startup:", err);
    process.exit(1);
  }
})();

