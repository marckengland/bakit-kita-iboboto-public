/**
 * AI Document Parser Service
 *
 * Handles PDF parsing and AI-assisted data extraction for bills and SALNs.
 * Uses OpenAI GPT-4 for intelligent data extraction and summary generation.
 *
 * **Validates: Requirements 20.4, 20.5, 20.6, 20.10**
 */

import { getVerifierModelConfig } from "./ai-config.service";

// ============================================
// Types and Interfaces
// ============================================

export type DocumentType = "bill" | "saln" | "resolution" | "soce" | "coa_report";

export type ExtractionStatus = "success" | "partial" | "failed";

export interface RawDocument {
  id: string;
  type: DocumentType;
  filename: string;
  content: string; // Base64 encoded PDF or extracted text
  sourceUrl?: string;
  uploadedAt: Date;
  metadata?: Record<string, string>;
}

export interface ExtractionConfidence {
  field: string;
  value: unknown;
  confidence: number;
  source: string; // Page number or section reference
  needsReview: boolean;
}

export interface ExtractedBillData {
  billNumber: string;
  title: string;
  summary: string;
  fullText?: string;
  filingDate?: Date;
  status?: "pending" | "passed" | "vetoed" | "lapsed" | "withdrawn";
  chamber?: "senate" | "house";
  congress?: number;
  session?: number;
  authors?: Array<{ name: string; role: "principal_author" | "co_author" }>;
  republicActNumber?: string;
}

export interface ExtractedSALNData {
  politicianName: string;
  year: number;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  declaredSalary?: number;
  realProperties: Array<{
    description: string;
    location?: string;
    assessedValue: number;
    acquisitionDate?: Date;
    acquisitionMode?: string;
  }>;
  personalProperties: Array<{
    description: string;
    value: number;
  }>;
  investments: Array<{
    description: string;
    value: number;
  }>;
  liabilities: Array<{
    description: string;
    amount: number;
    creditor?: string;
  }>;
}

export interface DocumentExtractionResult<T> {
  documentId: string;
  documentType: DocumentType;
  status: ExtractionStatus;
  data: T | null;
  summary?: string;
  confidenceScores: ExtractionConfidence[];
  overallConfidence: number;
  lowConfidenceFields: string[];
  needsManualReview: boolean;
  processingTimeMs: number;
  modelUsed: string;
  errors: string[];
  warnings: string[];
}

export interface ParsedPDFContent {
  text: string;
  pages: Array<{
    pageNumber: number;
    content: string;
  }>;
  metadata: {
    title?: string;
    author?: string;
    creationDate?: Date;
    pageCount: number;
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  correctedData?: Record<string, unknown>;
}

// ============================================
// Constants
// ============================================

export const CONFIDENCE_THRESHOLD = 0.7;
export const LOW_CONFIDENCE_THRESHOLD = 0.5;
export const AUTO_PUBLISH_THRESHOLD = 0.85;

// Field importance weights for overall confidence calculation
export const BILL_FIELD_WEIGHTS: Record<string, number> = {
  billNumber: 1.0,
  title: 0.9,
  summary: 0.7,
  filingDate: 0.8,
  chamber: 0.9,
  authors: 0.6,
  status: 0.7,
};

export const SALN_FIELD_WEIGHTS: Record<string, number> = {
  politicianName: 1.0,
  year: 1.0,
  totalAssets: 0.9,
  totalLiabilities: 0.9,
  netWorth: 0.9,
  realProperties: 0.7,
  personalProperties: 0.6,
  investments: 0.6,
};

// ============================================
// Error Classes
// ============================================

export class DocumentParserError extends Error {
  constructor(
    message: string,
    public code:
      | "INVALID_DOCUMENT"
      | "PARSE_FAILED"
      | "EXTRACTION_FAILED"
      | "VALIDATION_FAILED"
      | "UNSUPPORTED_FORMAT"
      | "AI_ERROR"
  ) {
    super(message);
    this.name = "DocumentParserError";
  }
}

// ============================================
// PDF Parsing Functions
// ============================================

/**
 * Parse PDF content from base64 encoded data
 * In production, this would use a PDF parsing library like pdf-parse or pdfjs-dist
 */
export async function parsePDF(base64Content: string): Promise<ParsedPDFContent> {
  // Simulate PDF parsing delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // In production, this would use actual PDF parsing:
  // const pdfParse = require('pdf-parse');
  // const buffer = Buffer.from(base64Content, 'base64');
  // const data = await pdfParse(buffer);

  // For now, return mock parsed content
  // The actual implementation would extract text from PDF
  const mockText = Buffer.from(base64Content, "base64").toString("utf-8");

  return {
    text: mockText,
    pages: [
      {
        pageNumber: 1,
        content: mockText,
      },
    ],
    metadata: {
      pageCount: 1,
      creationDate: new Date(),
    },
  };
}

/**
 * Extract text from a raw document
 */
export async function extractTextFromDocument(document: RawDocument): Promise<string> {
  if (document.content.startsWith("data:application/pdf")) {
    // Handle data URL format
    const base64 = document.content.split(",")[1] || "";
    const parsed = await parsePDF(base64);
    return parsed.text;
  }

  // Try to parse as base64 PDF
  try {
    const parsed = await parsePDF(document.content);
    return parsed.text;
  } catch {
    // Assume it's already plain text
    return document.content;
  }
}

// ============================================
// AI Extraction Functions
// ============================================

/**
 * Generate AI prompt for bill extraction
 */
export function generateBillExtractionPrompt(text: string): string {
  return `Extract structured data from the following Philippine legislative bill document.

Return a JSON object with these fields:
- billNumber: The official bill number (e.g., "SB-1234" or "HB-5678")
- title: The full title of the bill
- summary: A concise summary of the bill's purpose and key provisions (2-3 sentences)
- filingDate: The date the bill was filed (ISO format YYYY-MM-DD)
- status: One of "pending", "passed", "vetoed", "lapsed", "withdrawn"
- chamber: Either "senate" or "house"
- congress: The congress number (e.g., 19)
- session: The session number (e.g., 1, 2, 3)
- authors: Array of objects with "name" and "role" ("principal_author" or "co_author")
- republicActNumber: If passed, the RA number (e.g., "RA 11234")

For each field, also provide a confidence score (0.0 to 1.0) based on how clearly the information was stated in the document.

Document text:
${text.substring(0, 15000)}

Respond with valid JSON only.`;
}

/**
 * Generate AI prompt for SALN extraction
 */
export function generateSALNExtractionPrompt(text: string): string {
  return `Extract structured data from the following Philippine Statement of Assets, Liabilities, and Net Worth (SALN) document.

Return a JSON object with these fields:
- politicianName: Full name of the declarant
- year: The year of the SALN declaration
- totalAssets: Total assets in Philippine Pesos (number)
- totalLiabilities: Total liabilities in Philippine Pesos (number)
- netWorth: Net worth in Philippine Pesos (number)
- declaredSalary: Annual salary if stated (number)
- realProperties: Array of objects with "description", "location", "assessedValue", "acquisitionDate", "acquisitionMode"
- personalProperties: Array of objects with "description", "value"
- investments: Array of objects with "description", "value"
- liabilities: Array of objects with "description", "amount", "creditor"

For each field, also provide a confidence score (0.0 to 1.0) based on how clearly the information was stated in the document.

Document text:
${text.substring(0, 15000)}

Respond with valid JSON only.`;
}

/**
 * Generate automatic bill summary using AI
 */
export async function generateBillSummary(
  billText: string,
  title: string
): Promise<{
  summary: string;
  confidence: number;
}> {
  // Get model config for display name (used in production)
  void getVerifierModelConfig();

  // Simulate AI processing
  await new Promise((resolve) => setTimeout(resolve, 50));

  // In production, this would call the actual AI API:
  // const modelConfig = getVerifierModelConfig();
  // const systemPrompt = `You are an expert in Philippine legislation...`;
  // const userPrompt = `Generate a summary for this Philippine bill...`;
  // const request = formatProviderRequest(modelConfig.provider, userPrompt, systemPrompt, { temperature: 0.3 });
  // const response = await fetch(getAPIEndpoint(modelConfig.provider), { ... });
  // const summary = parseProviderResponse(modelConfig.provider, await response.json());

  // Mock summary generation based on title
  void billText; // Used in production for actual AI processing
  const summary = `This bill proposes ${title.toLowerCase().includes("act") ? "legislation" : "measures"} related to ${title.substring(0, 100)}. It aims to establish regulatory frameworks and provisions for implementation. The bill affects relevant stakeholders and government agencies.`;

  return {
    summary,
    confidence: 0.85,
  };
}

/**
 * Call AI model for data extraction
 */
export async function callAIForExtraction(
  prompt: string,
  documentType: DocumentType
): Promise<{
  data: Record<string, unknown>;
  confidenceScores: Record<string, number>;
}> {
  // Get model config for display name (used in production)
  void getVerifierModelConfig();

  // Simulate AI processing delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // In production, this would call the actual AI API:
  // const modelConfig = getVerifierModelConfig();
  // const systemPrompt = `You are an expert document parser...`;
  // const request = formatProviderRequest(modelConfig.provider, prompt, systemPrompt, { temperature: 0.1 });
  // const response = await fetch(getAPIEndpoint(modelConfig.provider), { ... });
  // const result = parseProviderResponse(modelConfig.provider, await response.json());
  // return JSON.parse(result);

  // Mark prompt as used (would be sent to AI in production)
  void prompt;

  // Mock extraction based on document type
  if (documentType === "bill") {
    return {
      data: {
        billNumber: "SB-1234",
        title: "An Act Providing for...",
        summary: "This bill aims to...",
        filingDate: new Date().toISOString().split("T")[0],
        status: "pending",
        chamber: "senate",
        congress: 19,
        session: 1,
        authors: [{ name: "Senator Name", role: "principal_author" }],
      },
      confidenceScores: {
        billNumber: 0.95,
        title: 0.9,
        summary: 0.75,
        filingDate: 0.85,
        status: 0.8,
        chamber: 0.95,
        congress: 0.9,
        session: 0.85,
        authors: 0.7,
      },
    };
  } else if (documentType === "saln") {
    return {
      data: {
        politicianName: "Juan Dela Cruz",
        year: 2023,
        totalAssets: 10000000,
        totalLiabilities: 2000000,
        netWorth: 8000000,
        declaredSalary: 500000,
        realProperties: [],
        personalProperties: [],
        investments: [],
        liabilities: [],
      },
      confidenceScores: {
        politicianName: 0.95,
        year: 0.98,
        totalAssets: 0.85,
        totalLiabilities: 0.85,
        netWorth: 0.9,
        declaredSalary: 0.75,
        realProperties: 0.6,
        personalProperties: 0.55,
        investments: 0.5,
        liabilities: 0.55,
      },
    };
  }

  return { data: {}, confidenceScores: {} };
}

// ============================================
// Validation Functions
// ============================================

/**
 * Validate extracted bill data
 */
export function validateBillData(data: Partial<ExtractedBillData>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const correctedData: Record<string, unknown> = { ...data };

  // Required field validation
  if (!data.billNumber) {
    errors.push("Bill number is required");
  } else if (!/^(SB|HB|SBN|HBN)-?\d+$/i.test(data.billNumber)) {
    warnings.push(`Bill number format may be incorrect: ${data.billNumber}`);
  }

  if (!data.title) {
    errors.push("Bill title is required");
  }

  // Chamber validation
  if (data.chamber && !["senate", "house"].includes(data.chamber)) {
    errors.push(`Invalid chamber: ${data.chamber}`);
  }

  // Status validation
  const validStatuses = ["pending", "passed", "vetoed", "lapsed", "withdrawn"];
  if (data.status && !validStatuses.includes(data.status)) {
    errors.push(`Invalid status: ${data.status}`);
  }

  // Date validation
  if (data.filingDate) {
    const date = new Date(data.filingDate);
    if (isNaN(date.getTime())) {
      errors.push("Invalid filing date format");
    } else if (date > new Date()) {
      warnings.push("Filing date is in the future");
    }
  }

  // Congress/Session validation
  if (data.congress !== undefined && (data.congress < 1 || data.congress > 25)) {
    warnings.push(`Congress number ${data.congress} seems unusual`);
  }

  if (data.session !== undefined && (data.session < 1 || data.session > 4)) {
    warnings.push(`Session number ${data.session} seems unusual`);
  }

  // Authors validation
  if (data.authors) {
    for (const author of data.authors) {
      if (!author.name) {
        warnings.push("Author name is missing");
      }
      if (author.role && !["principal_author", "co_author"].includes(author.role)) {
        warnings.push(`Invalid author role: ${author.role}`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    correctedData: errors.length === 0 ? correctedData : undefined,
  };
}

/**
 * Validate extracted SALN data
 */
export function validateSALNData(data: Partial<ExtractedSALNData>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const correctedData: Record<string, unknown> = { ...data };

  // Required field validation
  if (!data.politicianName) {
    errors.push("Politician name is required");
  }

  if (!data.year) {
    errors.push("SALN year is required");
  } else if (data.year < 1990 || data.year > new Date().getFullYear()) {
    warnings.push(`SALN year ${data.year} seems unusual`);
  }

  // Financial data validation
  if (data.totalAssets === undefined || data.totalAssets < 0) {
    errors.push("Total assets must be a non-negative number");
  }

  if (data.totalLiabilities === undefined || data.totalLiabilities < 0) {
    errors.push("Total liabilities must be a non-negative number");
  }

  if (data.netWorth === undefined) {
    errors.push("Net worth is required");
  }

  // Net worth consistency check
  if (
    data.totalAssets !== undefined &&
    data.totalLiabilities !== undefined &&
    data.netWorth !== undefined
  ) {
    const calculatedNetWorth = data.totalAssets - data.totalLiabilities;
    const difference = Math.abs(calculatedNetWorth - data.netWorth);
    const tolerance = Math.max(calculatedNetWorth * 0.01, 1000); // 1% or 1000 PHP tolerance

    if (difference > tolerance) {
      warnings.push(
        `Net worth (${data.netWorth}) doesn't match assets (${data.totalAssets}) - liabilities (${data.totalLiabilities}) = ${calculatedNetWorth}`
      );
      // Auto-correct net worth
      correctedData.netWorth = calculatedNetWorth;
    }
  }

  // Property validation
  if (data.realProperties) {
    for (let i = 0; i < data.realProperties.length; i++) {
      const prop = data.realProperties[i];
      if (!prop) {
        continue;
      }
      if (!prop.description) {
        warnings.push(`Real property ${i + 1} is missing description`);
      }
      if (prop.assessedValue < 0) {
        errors.push(`Real property ${i + 1} has negative assessed value`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    correctedData: errors.length === 0 ? correctedData : undefined,
  };
}

// ============================================
// Confidence Calculation Functions
// ============================================

/**
 * Calculate overall confidence score from individual field scores
 */
export function calculateOverallConfidence(
  confidenceScores: Record<string, number>,
  fieldWeights: Record<string, number>
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [field, confidence] of Object.entries(confidenceScores)) {
    const weight = fieldWeights[field] || 0.5;
    weightedSum += confidence * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return 0;
  }
  return weightedSum / totalWeight;
}

/**
 * Identify low confidence fields that need review
 */
export function identifyLowConfidenceFields(
  confidenceScores: Record<string, number>,
  threshold: number = LOW_CONFIDENCE_THRESHOLD
): string[] {
  return Object.entries(confidenceScores)
    .filter(([, confidence]) => confidence < threshold)
    .map(([field]) => field);
}

/**
 * Build confidence score objects for extraction result
 */
export function buildConfidenceScores(
  data: Record<string, unknown>,
  confidenceScores: Record<string, number>,
  _documentType: DocumentType
): ExtractionConfidence[] {
  return Object.entries(data).map(([field, value]) => ({
    field,
    value,
    confidence: confidenceScores[field] || 0.5,
    source: "Page 1", // In production, track actual page/section
    needsReview: (confidenceScores[field] || 0.5) < CONFIDENCE_THRESHOLD,
  }));
}

// ============================================
// Core Extraction Functions
// ============================================

/**
 * Extract bill data from a document
 */
export async function extractBillData(
  document: RawDocument
): Promise<DocumentExtractionResult<ExtractedBillData>> {
  const startTime = Date.now();
  const modelConfig = getVerifierModelConfig();
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Extract text from document
    const text = await extractTextFromDocument(document);

    if (!text || text.trim().length === 0) {
      throw new DocumentParserError("Document is empty or unreadable", "INVALID_DOCUMENT");
    }

    // Generate extraction prompt and call AI
    const prompt = generateBillExtractionPrompt(text);
    const { data, confidenceScores } = await callAIForExtraction(prompt, "bill");

    // Generate summary if not provided
    let summary = data.summary as string;
    if (!summary && data.title) {
      const summaryResult = await generateBillSummary(text, data.title as string);
      summary = summaryResult.summary;
      confidenceScores.summary = summaryResult.confidence;
      data.summary = summary;
    }

    // Validate extracted data
    const validation = validateBillData(data as Partial<ExtractedBillData>);
    errors.push(...validation.errors);
    warnings.push(...validation.warnings);

    // Calculate confidence
    const overallConfidence = calculateOverallConfidence(confidenceScores, BILL_FIELD_WEIGHTS);
    const lowConfidenceFields = identifyLowConfidenceFields(confidenceScores);
    const confidenceScoresList = buildConfidenceScores(data, confidenceScores, "bill");

    // Determine status
    let status: ExtractionStatus = "success";
    if (errors.length > 0) {
      status = "failed";
    } else if (lowConfidenceFields.length > 0 || warnings.length > 0) {
      status = "partial";
    }

    return {
      documentId: document.id,
      documentType: "bill",
      status,
      data: validation.isValid ? (data as unknown as ExtractedBillData) : null,
      summary,
      confidenceScores: confidenceScoresList,
      overallConfidence,
      lowConfidenceFields,
      needsManualReview:
        overallConfidence < AUTO_PUBLISH_THRESHOLD || lowConfidenceFields.length > 0,
      processingTimeMs: Date.now() - startTime,
      modelUsed: modelConfig.displayName,
      errors,
      warnings,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    errors.push(errorMessage);

    return {
      documentId: document.id,
      documentType: "bill",
      status: "failed",
      data: null,
      confidenceScores: [],
      overallConfidence: 0,
      lowConfidenceFields: [],
      needsManualReview: true,
      processingTimeMs: Date.now() - startTime,
      modelUsed: modelConfig.displayName,
      errors,
      warnings,
    };
  }
}

/**
 * Extract SALN data from a document
 */
export async function extractSALNData(
  document: RawDocument
): Promise<DocumentExtractionResult<ExtractedSALNData>> {
  const startTime = Date.now();
  const modelConfig = getVerifierModelConfig();
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Extract text from document
    const text = await extractTextFromDocument(document);

    if (!text || text.trim().length === 0) {
      throw new DocumentParserError("Document is empty or unreadable", "INVALID_DOCUMENT");
    }

    // Generate extraction prompt and call AI
    const prompt = generateSALNExtractionPrompt(text);
    const { data, confidenceScores } = await callAIForExtraction(prompt, "saln");

    // Validate extracted data
    const validation = validateSALNData(data as Partial<ExtractedSALNData>);
    errors.push(...validation.errors);
    warnings.push(...validation.warnings);

    // Apply corrections if any
    const finalData = validation.correctedData || data;

    // Calculate confidence
    const overallConfidence = calculateOverallConfidence(confidenceScores, SALN_FIELD_WEIGHTS);
    const lowConfidenceFields = identifyLowConfidenceFields(confidenceScores);
    const confidenceScoresList = buildConfidenceScores(finalData, confidenceScores, "saln");

    // Determine status
    let status: ExtractionStatus = "success";
    if (errors.length > 0) {
      status = "failed";
    } else if (lowConfidenceFields.length > 0 || warnings.length > 0) {
      status = "partial";
    }

    return {
      documentId: document.id,
      documentType: "saln",
      status,
      data: validation.isValid ? (finalData as unknown as ExtractedSALNData) : null,
      confidenceScores: confidenceScoresList,
      overallConfidence,
      lowConfidenceFields,
      needsManualReview:
        overallConfidence < AUTO_PUBLISH_THRESHOLD || lowConfidenceFields.length > 0,
      processingTimeMs: Date.now() - startTime,
      modelUsed: modelConfig.displayName,
      errors,
      warnings,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    errors.push(errorMessage);

    return {
      documentId: document.id,
      documentType: "saln",
      status: "failed",
      data: null,
      confidenceScores: [],
      overallConfidence: 0,
      lowConfidenceFields: [],
      needsManualReview: true,
      processingTimeMs: Date.now() - startTime,
      modelUsed: modelConfig.displayName,
      errors,
      warnings,
    };
  }
}

/**
 * Process a document and extract data based on type
 */
export async function processDocument(
  document: RawDocument
): Promise<DocumentExtractionResult<ExtractedBillData | ExtractedSALNData>> {
  switch (document.type) {
    case "bill":
    case "resolution":
      return extractBillData(document);
    case "saln":
      return extractSALNData(document);
    default:
      throw new DocumentParserError(
        `Unsupported document type: ${document.type}`,
        "UNSUPPORTED_FORMAT"
      );
  }
}

/**
 * Check if extraction result should be auto-published
 */
export function canAutoPublish(result: DocumentExtractionResult<unknown>): boolean {
  return (
    result.status === "success" &&
    result.overallConfidence >= AUTO_PUBLISH_THRESHOLD &&
    result.lowConfidenceFields.length === 0 &&
    result.errors.length === 0 &&
    !result.needsManualReview
  );
}

/**
 * Get extraction status summary
 */
export function getExtractionSummary(result: DocumentExtractionResult<unknown>): {
  canPublish: boolean;
  needsReview: boolean;
  reviewReasons: string[];
  confidence: number;
} {
  const reviewReasons: string[] = [];

  if (result.overallConfidence < AUTO_PUBLISH_THRESHOLD) {
    reviewReasons.push(`Low overall confidence: ${(result.overallConfidence * 100).toFixed(1)}%`);
  }

  if (result.lowConfidenceFields.length > 0) {
    reviewReasons.push(`Low confidence fields: ${result.lowConfidenceFields.join(", ")}`);
  }

  if (result.errors.length > 0) {
    reviewReasons.push(`Extraction errors: ${result.errors.length}`);
  }

  if (result.warnings.length > 0) {
    reviewReasons.push(`Warnings: ${result.warnings.length}`);
  }

  return {
    canPublish: canAutoPublish(result),
    needsReview: result.needsManualReview,
    reviewReasons,
    confidence: result.overallConfidence,
  };
}
