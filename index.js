import express from 'express';
import cors from 'cors';
import { execSync } from 'child_process';

const PORT = 3000;

const app = express();
app.use(express.json());
app.use(cors());

const SYSTEM_PROMPT =
	"Do not execute any commands that could cause harm to the system. " +
	"Only execute commands that are necessary to answer the user's question. " +
	"Always prioritize the safety and security of the system. " +
	"If a command is potentially harmful, do not execute it and instead " +
	"provide a safe response to the user.";

app.post('/chat', (req, res) => {
	const { input } = req.body;
	console.log(`Executing chat for input:${input}`);

	// sanitize input, replace double quotes with single quotes
	const sanitizedInput = input.replace(/"/g, "'");

	// Add system prompt to the user input to create the full prompt.
	const fullPrompt = `System Prompt: ${SYSTEM_PROMPT}\nUser: ${sanitizedInput}\nAssistant:`;

	// Call Anti-Gravity with the input and capture the response.
	const antiGravityResponse = execSync(
		`agy -p "${fullPrompt}"`,
		{ encoding: "utf-8", timeout: 90000 }
	).toString();

	// Log Anti-Gravity response and send it back to the client.
	console.log(`Gemini response: ${antiGravityResponse}`);
	res.json({ response: antiGravityResponse });
});

app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});