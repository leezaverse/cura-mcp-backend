import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { execSync } from 'child_process';

const { Client } = pg;
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


///////////////////////////////////// DATABASE CONNECTION ////////////////////////////////////////////////////

const pgClientConfiguration = {
	user: process.env.DB_USER,
	host: process.env.DB_HOST,
	database: process.env.DB_DATABASE,
	password: process.env.DB_PASSWORD,
	port: parseInt(process.env.DB_PORT, 10),
};

const dbClient = new Client(pgClientConfiguration);
dbClient.connect();

/////////////////////////////////////////// API /////////////////////////////////////////////////////////////

app.post('/conversations/:id/chat', async (req, res) => {
	const { input } = req.body;
	const dbConversationId = "ef7fc115-90f8-4f4f-940d-24fb77bd62cf";
	const dbGoogleUserId = "leeza";
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

	// Store input in the database
	const queryText = "INSERT INTO chat_history (conversation_id, google_user_id, input_text, output_text) VALUES ($1, $2, $3, $4)";
	const queryValues = [dbConversationId, dbGoogleUserId, input, antiGravityResponse];
	await dbClient.query(queryText, queryValues);

	res.json({ response: antiGravityResponse });
});

app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});
