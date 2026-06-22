export function simpleUserAgent(userAgent = "") {
	return `${browser(userAgent)}/${os(userAgent)}`;
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