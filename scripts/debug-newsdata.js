// Run with: node --env-file=.env scripts/debug-newsdata.js
// Prints the raw NewsData.io response for one politician so you can
// confirm your API key and query are working before running the full
// pipeline.
import axios from "axios";

const apiKey = process.env.NEWSDATA_API_KEY;
if (!apiKey) {
  console.error("Missing NEWSDATA_API_KEY in your environment/.env file.");
  process.exit(1);
}

try {
  const res = await axios.get("https://newsdata.io/api/1/latest", {
    params: {
      apikey: apiKey,
      q: '"Shenna Bellows"',
      language: "en",
      timeframe: 24,
    },
  });
  console.log("status:", res.status);
  console.log("response status field:", res.data.status);
  console.log("totalResults:", res.data.totalResults);
  console.log("results returned:", res.data.results?.length);
  console.log("nextPage:", res.data.nextPage);
  if (res.data.results?.[0]) {
    console.log("sample article:", JSON.stringify(res.data.results[0], null, 2));
  }
} catch (err) {
  console.log("REQUEST FAILED");
  console.log("status:", err.response?.status);
  console.log("body:", JSON.stringify(err.response?.data, null, 2));
}
