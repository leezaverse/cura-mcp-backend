import express from 'express';
import cors from 'cors';
import { execSync } from 'child_process';

const PORT = 3000;

const app = express();
app.use(express.json());
app.use(cors());

app.post('/chat', (req, res) => {
	// console.log("\n\n\n\nReceived chat request");
	// console.log(req.body);
	const { input } = req.body;
	console.log(`Executing chat for input:${input}`);

	// sanitize input, replace double quotes with single quotes
	const sanitizedInput = input.replace(/"/g, "'");

	// Call Anti-Gravity with the input and capture the response.
	const antiGravityResponse = execSync(`agy -p "${sanitizedInput}"`, { encoding: "utf-8", timeout: 90000 }).toString();

	// Log Anti-Gravity response and send it back to the client.
	console.log(`Gemini response: ${antiGravityResponse}`);
	res.json({ response: antiGravityResponse });
});

app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});