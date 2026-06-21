import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { parse, type DefaultTreeAdapterTypes } from "parse5";

type Node = DefaultTreeAdapterTypes.Node;
type ParentNode = DefaultTreeAdapterTypes.ParentNode;
type ChildNode = DefaultTreeAdapterTypes.ChildNode;
type Element = DefaultTreeAdapterTypes.Element;
type TextNode = DefaultTreeAdapterTypes.TextNode;

const lineBreakToken = "\u0000line-break\u0000";

const { values } = parseArgs({
	options: {
		input: { type: "string" },
		output: { type: "string" },
	},
});

if (!values.input || !values.output) {
	throw new Error(
		"Usage: node scripts/resume-markdown.ts --input <html-file> --output <markdown-file>",
	);
}

const inputFile = path.resolve(process.cwd(), values.input);
const outputFile = path.resolve(process.cwd(), values.output);

const html = readFileSync(inputFile, "utf8");
const document = parse(html);
const body = findFirstElement(document, (element) => element.tagName === "body");

if (!body) {
	throw new Error(`Unable to find <body> in ${inputFile}`);
}

const resumeRoot = findFirstElement(body, (element) => hasClass(element, "resume-page")) ?? body;
const markdown = renderResume(resumeRoot);

writeFileSync(outputFile, markdown);
console.log(`Wrote ${path.relative(process.cwd(), outputFile)}`);

function renderResume(root: Element) {
	const header = findDirectElement(root, "header");
	const main = findDirectElement(root, "main");
	const blocks: string[] = [];

	if (header) {
		blocks.push(...renderHeader(header));
	}

	if (main) {
		blocks.push(...renderBlockChildren(main));
	} else {
		for (const child of root.childNodes) {
			if (child === header) continue;
			blocks.push(...renderBlock(child));
		}
	}

	return cleanMarkdown(blocks.join("\n\n"));
}

function renderHeader(header: Element) {
	const blocks: string[] = [];
	const title = findDirectElement(header, "h1");

	if (title) {
		blocks.push(`# ${normalizeText(textContent(title))}`);
	}

	for (const child of childElements(header)) {
		if (child === title) continue;

		const text = normalizeInlineText(renderInlineChildren(child));
		if (!text) continue;

		blocks.push(hasClass(child, "headline") ? `**${text}**` : text);
	}

	return blocks;
}

function renderSection(section: Element) {
	const heading = findDirectElement(section, "h2");
	const blocks: string[] = [];

	if (heading) {
		blocks.push(`## ${normalizeText(textContent(heading))}`);
	}

	for (const child of section.childNodes) {
		if (child === heading) continue;
		blocks.push(...renderBlock(child));
	}

	return blocks.join("\n\n");
}

function renderArticle(article: Element) {
	const heading = childElements(article).find((child) => /^h[1-6]$/.test(child.tagName));
	const blocks: string[] = [];

	if (heading) {
		blocks.push(`### ${normalizeText(textContent(heading))}`);
	}

	for (const child of article.childNodes) {
		if (child === heading) continue;
		blocks.push(...renderBlock(child));
	}

	return blocks.join("\n\n");
}

function renderBlock(node: ChildNode): string[] {
	if (isTextNode(node)) {
		const text = normalizeText(node.value);
		return text ? [text] : [];
	}

	if (!isElement(node)) return [];

	if (node.tagName === "style" || node.tagName === "script") return [];

	if (node.tagName === "section") return [renderSection(node)];
	if (node.tagName === "article") return [renderArticle(node)];
	if (node.tagName === "ul" || node.tagName === "ol") return [renderList(node)];
	if (node.tagName === "p" || node.tagName === "address") {
		const text = normalizeInlineText(renderInlineChildren(node));
		return text ? [text] : [];
	}

	if (/^h[1-6]$/.test(node.tagName)) {
		const depth = Number(node.tagName.slice(1));
		const text = normalizeText(textContent(node));
		return text ? [`${"#".repeat(depth)} ${text}`] : [];
	}

	return renderBlockChildren(node);
}

function renderBlockChildren(parent: ParentNode) {
	return parent.childNodes.flatMap((child) => renderBlock(child));
}

function renderList(list: Element) {
	const ordered = list.tagName === "ol";
	const lines: string[] = [];
	let index = 1;

	for (const item of childElements(list).filter((child) => child.tagName === "li")) {
		const marker = ordered ? `${index}.` : "-";
		const text = renderListItem(item);

		if (!text) {
			lines.push(marker);
		} else {
			const [firstLine = "", ...restLines] = text.split("\n");
			lines.push(firstLine ? `${marker} ${firstLine}` : marker);

			for (const line of restLines) {
				lines.push(line ? `  ${line}` : "");
			}
		}

		index += 1;
	}

	return lines.join("\n");
}

function renderListItem(item: Element) {
	const blocks: string[] = [];
	let inline = "";

	function flushInline() {
		const text = normalizeInlineText(inline);
		if (text) blocks.push(text);
		inline = "";
	}

	for (const child of item.childNodes) {
		if (isElement(child) && isList(child)) continue;

		if (isElement(child) && isBlockElement(child)) {
			flushInline();
			blocks.push(...renderBlock(child));
		} else {
			inline += renderInline(child);
		}
	}

	flushInline();

	const text = blocks.join("\n\n");
	const nestedLists = childElements(item).filter(isList).map(renderList).join("\n");

	if (!text) return nestedLists;
	if (!nestedLists) return text;
	return `${text}\n${nestedLists}`;
}

function renderInlineChildren(parent: ParentNode) {
	return parent.childNodes.map((child) => renderInline(child)).join("");
}

function renderInline(node: ChildNode): string {
	if (isTextNode(node)) return node.value;
	if (!isElement(node)) return "";

	if (node.tagName === "style" || node.tagName === "script") return "";
	if (node.tagName === "br") return lineBreakToken;

	const text = normalizeInlineText(renderInlineChildren(node));

	if (!text) return "";

	if (node.tagName === "a") {
		const href = getAttribute(node, "href");
		if (!href || href === text) return text;
		return `[${text}](${href})`;
	}

	if (node.tagName === "strong" || node.tagName === "b" || hasClass(node, "label")) {
		return `**${text}**`;
	}

	if (node.tagName === "em" || node.tagName === "i") {
		return `*${text}*`;
	}

	return renderInlineChildren(node);
}

function findFirstElement(
	parent: ParentNode,
	predicate: (element: Element) => boolean,
): Element | undefined {
	for (const child of childElements(parent)) {
		if (predicate(child)) return child;

		const match = findFirstElement(child, predicate);
		if (match) return match;
	}
}

function findDirectElement(parent: ParentNode, tagName: string) {
	return childElements(parent).find((child) => child.tagName === tagName);
}

function childElements(parent: ParentNode) {
	return parent.childNodes.filter(isElement);
}

function textContent(node: Node): string {
	if (isTextNode(node)) return node.value;
	if (!hasChildren(node)) return "";
	if (isElement(node) && (node.tagName === "style" || node.tagName === "script")) return "";
	return node.childNodes.map(textContent).join("");
}

function getAttribute(element: Element, name: string) {
	return element.attrs.find((attribute) => attribute.name === name)?.value;
}

function hasClass(element: Element, className: string) {
	return getAttribute(element, "class")?.split(/\s+/).includes(className) ?? false;
}

function isList(element: Element) {
	return element.tagName === "ul" || element.tagName === "ol";
}

function isBlockElement(element: Element) {
	return (
		/^h[1-6]$/.test(element.tagName) ||
		[
			"address",
			"article",
			"blockquote",
			"div",
			"footer",
			"header",
			"li",
			"main",
			"nav",
			"ol",
			"p",
			"section",
			"ul",
		].includes(element.tagName)
	);
}

function isElement(node: Node): node is Element {
	return "tagName" in node;
}

function isTextNode(node: Node): node is TextNode {
	return node.nodeName === "#text";
}

function hasChildren(node: Node): node is ParentNode {
	return "childNodes" in node;
}

function normalizeText(text: string) {
	return text.replace(/\s+/g, " ").trim();
}

function normalizeInlineText(text: string) {
	return text
		.split(lineBreakToken)
		.map((part) => normalizeText(part))
		.join("\n")
		.trim();
}

function cleanMarkdown(markdown: string) {
	return `${markdown.replace(/\n{3,}/g, "\n\n").trim()}\n`;
}
