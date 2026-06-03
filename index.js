import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { execSync, execFileSync } from 'child_process';
import dotenv from 'dotenv';

const { Client } = pg;
const PORT = 3000;

const app = express();
app.use(express.json());
app.use(cors());
dotenv.config();


const SYSTEM_PROMPT = `
You are a healthcare data assistant connected to a PostgreSQL database through MCP.

DATABASE CONTEXT:
- The PostgreSQL MCP server is your primary source of truth for any data.
- Unless the user explicitly refers to another system, database-related questions should be assumed to refer to the connected PostgreSQL database.
- If information can be obtained from the database, query the database instead of asking for clarification.
- You may inspect schemas, tables, columns, and data when necessary to answer questions.
- When querying you may use general-english synonyms or medical synonyms to expand the search space or filter results.

DOMAIN RESTRICTIONS:
- Answer only questions related to healthcare data, patient records, clinical information, database contents, analytics, reporting, or the MCP-integrated system.
- If a question is unrelated to healthcare, patient data, database operations, analytics, or the application itself, politely refuse to answer.

SAFETY:
- Never execute destructive operations.
- Never modify, delete, truncate, drop, alter, or overwrite data.
- Use read-only operations whenever possible.
- Do not create files on the system.
- Only execute commands necessary to answer the user's question.

RESPONSE FORMAT:
- Your output will be rendered in HTML as a plain text.
- Do not use Markdown tables.
- If tabular data is required, return in space separated.
- Keep responses concise and relevant.
`;


///////////////////////////////////// DATABASE CONNECTION /////////////////////////////////////////

const pgClientConfiguration = {
	user: process.env.DB_USER,
	host: process.env.DB_HOST,
	database: process.env.DB_DATABASE,
	password: process.env.DB_PASSWORD,
	port: parseInt(process.env.DB_PORT, 10),
};

const dbClient = new Client(pgClientConfiguration);
dbClient.connect();

function authenticateToken(req, res, next) {
	const authHeader = req.headers.authorization;
	const token = authHeader && authHeader.split(' ')[1];

	if (!token) {
		return res.status(401).json({ error: 'Access token required' });
	}

	try {
		const payloadPart = token.split('.')[1];
		if (!payloadPart) {
			return res.status(403).json({ error: 'Invalid token format' });
		}
		const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
		const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
		
		if (!payload.email) {
			return res.status(403).json({ error: 'Token missing email' });
		}
		
		req.user = payload;
		next();
	} catch (err) {
		console.error("Token authentication failed:", err);
		return res.status(403).json({ error: 'Invalid or expired token' });
	}
}

/////////////////////////////////////////// API ///////////////////////////////////////////////////

app.get('/conversations', authenticateToken, async (req, res) => {
	const userId = req.user.email;
	console.log(`Fetching conversations for user: ${userId}`);

	const result = await dbClient.query(
		`
		SELECT
			conversation_id,
			MAX(created_at) AS last_message_time
		FROM chat_history
		WHERE google_user_id = $1
		GROUP BY conversation_id
		ORDER BY last_message_time DESC
		`,
		[userId]
	);

	res.json(result.rows);
});

app.get('/conversations/:conversationId/', authenticateToken, async (req, res) => {
	const { conversationId } = req.params;
	console.log(`Fetching chat history for conversation: ${conversationId}`);

	const result = await dbClient.query(
		`
		SELECT input_text, output_text, created_at
		FROM chat_history
		WHERE conversation_id = $1
		ORDER BY created_at ASC
		`,
		[conversationId]
	);

	res.json(result.rows);
});

app.post('/conversations/:conversationId/chat', authenticateToken, async (req, res) => {
	const { input } = req.body;
	const { conversationId } = req.params;
	const userId = req.user.email;
	console.log(`Executing chat for input:${input}`);

	// sanitize input, replace double quotes with single quotes
	const sanitizedInput = input.replace(/"/g, "'");

	// Add system prompt to the user input to create the full prompt.
	const fullPrompt = `System Prompt: ${SYSTEM_PROMPT}\nUser: ${sanitizedInput}\nAssistant:`;

	// Call Assistant via copilot CLI (non-interactive per-request)
	console.time('assistantExecutionTime');
	let assistantResponse = '';
	try {
		assistantResponse = execFileSync(
			'copilot',
			['-p', fullPrompt, '--allow-all-tools'],
			{ encoding: 'utf-8', timeout: 300000 }
		).toString();
	} catch (err) {
		console.error('Copilot CLI failed:', err && err.message ? err.message : err);
		return res.status(503).json({ error: 'Copilot CLI failed' });
	}
	console.timeEnd('assistantExecutionTime');

	// Store input in the database
	const queryText = "INSERT INTO chat_history (conversation_id, google_user_id, input_text, output_text) VALUES ($1, $2, $3, $4)";
	const queryValues = [conversationId, userId, input, assistantResponse];
	await dbClient.query(queryText, queryValues);

	res.json({ response: assistantResponse });
});

app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});
