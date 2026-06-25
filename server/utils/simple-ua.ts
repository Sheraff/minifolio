export function simpleUserAgent(userAgent = "") {
	return `${browser(userAgent)}/${os(userAgent)}`;
}

export function simpleBotAgent(userAgent = "") {
	if (!userAgent.trim()) return "Unknown";

	const agent = bot(userAgent);
	const client = simpleUserAgent(userAgent);
	return agent === "Unknown" ? client : `${agent} (${client})`;
}

function bot(userAgent: string) {
	switch(true) {
		case (/\bClaude[- ]?Code\b/i.test(userAgent)): return "Claude Code"
		case (/\bClaude(?:Bot|-User)?\b|\bAnthropic\b/i.test(userAgent)): return "Claude"
		case (/\bOpenCode\b/i.test(userAgent)): return "opencode"
		case (/\bCodex\b/i.test(userAgent)): return "Codex"
		case (/\bChatGPT(?:-User)?\b|\bGPTBot\b|\bOAI-SearchBot\b|\bOpenAI\b/i.test(userAgent)): return "OpenAI"
		case (/\bPerplexity(?:Bot|-User)?\b/i.test(userAgent)): return "Perplexity"
		case (/\bPi(?:Bot|Browser|\/)\b|\bInflection\b/i.test(userAgent)): return "Pi"
		case (/\bGoogle(?:bot|-Extended|Other)\b/i.test(userAgent)): return "Google"
		case (/\bApplebot\b/i.test(userAgent)): return "Apple"
		case (/\bBing(?:bot|Preview)\b/i.test(userAgent)): return "Bing"
		case (/\bDuckDuckBot\b/i.test(userAgent)): return "DuckDuckGo"
		case (/\bCCBot\b/i.test(userAgent)): return "Common Crawl"
		default: return "Unknown"
	}
}

function os(userAgent: string) {
	switch (true) {
		case (/Android/i.test(userAgent)): return "Android"
		case (/iPhone|iPad|iPod/i.test(userAgent)): return "iOS"
		case (/Mac OS X|Macintosh/i.test(userAgent)): return "macOS"
		case (/Windows/i.test(userAgent)): return "Windows"
		case (/Linux/i.test(userAgent)): return "Linux"
		default: return "Unknown"
	}
}

function browser(userAgent: string) {
	switch(true) {
		case (/Edg\//i.test(userAgent)): return "Edge"
		case (/OPR\//i.test(userAgent)): return "Opera"
		case (/Chrome\//i.test(userAgent) && !/Chromium/i.test(userAgent)): return "Chrome"
		case (/Firefox\//i.test(userAgent)): return "Firefox"
		case (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)): return "Safari"
		case (/curl\//i.test(userAgent)): return "curl"
		case (/bot|crawler|spider|preview/i.test(userAgent)): return "Bot"
		default: return "Unknown"
	}
}
