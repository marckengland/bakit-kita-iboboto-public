/**
 * API Documentation Page
 *
 * Provides comprehensive documentation for the public REST API.
 *
 * **Validates: Requirement 34.5 - Comprehensive documentation with examples**
 */

"use client";

import { useState } from "react";

interface EndpointDoc {
  method: string;
  path: string;
  description: string;
  parameters?: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
  example: {
    request: string;
    response: string;
  };
}

const endpoints: EndpointDoc[] = [
  {
    method: "GET",
    path: "/api/v1/politicians",
    description: "Returns a paginated list of politicians with filtering options.",
    parameters: [
      { name: "page", type: "integer", required: false, description: "Page number (default: 1)" },
      {
        name: "pageSize",
        type: "integer",
        required: false,
        description: "Items per page (default: 20, max: 100)",
      },
      {
        name: "level",
        type: "string",
        required: false,
        description: "Government level: national, regional, provincial, city, municipal, barangay",
      },
      { name: "region", type: "string", required: false, description: "Filter by region" },
      { name: "province", type: "string", required: false, description: "Filter by province" },
      { name: "city", type: "string", required: false, description: "Filter by city" },
      { name: "party", type: "string", required: false, description: "Filter by political party" },
      { name: "position", type: "string", required: false, description: "Filter by position type" },
      {
        name: "hasRedFlags",
        type: "boolean",
        required: false,
        description: "Filter by red flag status",
      },
    ],
    example: {
      request: `curl -X GET "https://api.bakitkitaiboboto.ph/api/v1/politicians?level=national&page=1&pageSize=10" \\
  -H "X-API-Key: bkib_live_your_api_key"`,
      response: `{
  "data": [
    {
      "id": "pol-123",
      "fullName": "Juan Dela Cruz",
      "photo": "https://...",
      "currentPosition": {
        "title": "Senator",
        "level": "national",
        "jurisdiction": "Philippines"
      },
      "currentParty": {
        "name": "Sample Party",
        "abbreviation": "SP"
      },
      "hasRedFlags": false
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 24,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "meta": {
    "apiVersion": "v1",
    "timestamp": "2024-01-15T10:30:00Z",
    "attribution": "Data sourced from official Philippine government records."
  }
}`,
    },
  },
  {
    method: "GET",
    path: "/api/v1/politicians/{id}",
    description: "Returns detailed information about a specific politician.",
    parameters: [{ name: "id", type: "string", required: true, description: "Politician ID" }],
    example: {
      request: `curl -X GET "https://api.bakitkitaiboboto.ph/api/v1/politicians/pol-123" \\
  -H "X-API-Key: bkib_live_your_api_key"`,
      response: `{
  "data": {
    "id": "pol-123",
    "fullName": "Juan Dela Cruz",
    "firstName": "Juan",
    "lastName": "Dela Cruz",
    "birthday": "1970-01-15",
    "birthplace": "Manila",
    "photo": "https://...",
    "isActive": true,
    "currentPosition": {
      "id": "pos-456",
      "title": "Senator",
      "level": "national",
      "jurisdiction": "Philippines",
      "startDate": "2022-06-30",
      "termNumber": 1,
      "isCurrent": true
    },
    "positions": [...],
    "partyAffiliations": [...],
    "hasRedFlags": false,
    "redFlagCount": 0,
    "sources": {...}
  },
  "meta": {...}
}`,
    },
  },
  {
    method: "GET",
    path: "/api/v1/bills",
    description: "Returns a paginated list of bills authored by a politician.",
    parameters: [
      {
        name: "politicianId",
        type: "string",
        required: true,
        description: "Politician ID (required)",
      },
      { name: "page", type: "integer", required: false, description: "Page number (default: 1)" },
      {
        name: "pageSize",
        type: "integer",
        required: false,
        description: "Items per page (default: 20, max: 100)",
      },
      {
        name: "status",
        type: "string",
        required: false,
        description: "Bill status: pending, passed, vetoed, lapsed, withdrawn",
      },
      {
        name: "authorRole",
        type: "string",
        required: false,
        description: "Author role: principal_author, co_author",
      },
      { name: "chamber", type: "string", required: false, description: "Chamber: senate, house" },
      { name: "congress", type: "integer", required: false, description: "Congress number" },
      {
        name: "sortBy",
        type: "string",
        required: false,
        description: "Sort field: filingDate, status, title",
      },
      { name: "sortOrder", type: "string", required: false, description: "Sort order: asc, desc" },
    ],
    example: {
      request: `curl -X GET "https://api.bakitkitaiboboto.ph/api/v1/bills?politicianId=pol-123&status=passed" \\
  -H "X-API-Key: bkib_live_your_api_key"`,
      response: `{
  "data": [
    {
      "id": "bill-789",
      "billNumber": "SB-1234",
      "title": "An Act Providing...",
      "summary": "This bill aims to...",
      "filingDate": "2023-07-15",
      "status": "passed",
      "republicActNumber": "RA 12345",
      "chamber": "senate",
      "congress": 19,
      "session": 1,
      "authorRole": "principal_author"
    }
  ],
  "pagination": {...},
  "meta": {...}
}`,
    },
  },
  {
    method: "GET",
    path: "/api/v1/bills/{id}",
    description: "Returns detailed information about a specific bill.",
    parameters: [{ name: "id", type: "string", required: true, description: "Bill ID" }],
    example: {
      request: `curl -X GET "https://api.bakitkitaiboboto.ph/api/v1/bills/bill-789" \\
  -H "X-API-Key: bkib_live_your_api_key"`,
      response: `{
  "data": {
    "id": "bill-789",
    "billNumber": "SB-1234",
    "title": "An Act Providing...",
    "summary": "This bill aims to...",
    "fullText": "Section 1. Short Title...",
    "filingDate": "2023-07-15",
    "status": "passed",
    "republicActNumber": "RA 12345",
    "chamber": "senate",
    "authors": [
      {
        "politicianId": "pol-123",
        "politicianName": "Juan Dela Cruz",
        "role": "principal_author"
      }
    ],
    "sources": [...]
  },
  "meta": {...}
}`,
    },
  },
  {
    method: "GET",
    path: "/api/v1/elections",
    description: "Returns election history for a politician.",
    parameters: [
      {
        name: "politicianId",
        type: "string",
        required: true,
        description: "Politician ID (required)",
      },
      { name: "year", type: "integer", required: false, description: "Filter by election year" },
      {
        name: "result",
        type: "string",
        required: false,
        description: "Filter by result: won, lost",
      },
    ],
    example: {
      request: `curl -X GET "https://api.bakitkitaiboboto.ph/api/v1/elections?politicianId=pol-123" \\
  -H "X-API-Key: bkib_live_your_api_key"`,
      response: `{
  "data": [
    {
      "id": "elec-456",
      "politicianId": "pol-123",
      "electionYear": 2022,
      "electionType": "national",
      "positionSought": "Senator",
      "jurisdiction": "Philippines",
      "result": "won",
      "voteCount": 15000000,
      "totalVotes": 60000000,
      "votePercentage": 25.0,
      "rank": 5,
      "marginOrDeficit": 500000,
      "opponents": [
        {
          "id": "opp-1",
          "name": "Opponent Name",
          "party": "Other Party",
          "voteCount": 14500000,
          "votePercentage": 24.17
        }
      ],
      "sources": [...]
    }
  ],
  "meta": {...}
}`,
    },
  },
  {
    method: "GET",
    path: "/api/v1/saln",
    description:
      "Returns SALN (Statement of Assets, Liabilities, and Net Worth) records for a politician.",
    parameters: [
      {
        name: "politicianId",
        type: "string",
        required: true,
        description: "Politician ID (required)",
      },
      { name: "year", type: "integer", required: false, description: "Filter by specific year" },
      {
        name: "includeTimeline",
        type: "boolean",
        required: false,
        description: "Include net worth timeline data",
      },
      {
        name: "includeDetails",
        type: "boolean",
        required: false,
        description: "Include detailed breakdown (default: true)",
      },
    ],
    example: {
      request: `curl -X GET "https://api.bakitkitaiboboto.ph/api/v1/saln?politicianId=pol-123&includeTimeline=true" \\
  -H "X-API-Key: bkib_live_your_api_key"`,
      response: `{
  "data": [
    {
      "id": "saln-789",
      "politicianId": "pol-123",
      "year": 2023,
      "totalAssets": 50000000,
      "totalLiabilities": 5000000,
      "netWorth": 45000000,
      "declaredSalary": 1200000,
      "anomalyDetected": false,
      "realProperties": [...],
      "personalProperties": [...],
      "investments": [...],
      "sources": [...]
    }
  ],
  "timeline": [
    {
      "year": 2020,
      "netWorth": 30000000,
      "yearOverYearChange": null,
      "anomalyDetected": false
    },
    {
      "year": 2021,
      "netWorth": 35000000,
      "yearOverYearChange": 16.67,
      "anomalyDetected": false
    }
  ],
  "meta": {...}
}`,
    },
  },
  {
    method: "GET",
    path: "/api/v1/saln/{id}",
    description: "Returns detailed information about a specific SALN record.",
    parameters: [{ name: "id", type: "string", required: true, description: "SALN record ID" }],
    example: {
      request: `curl -X GET "https://api.bakitkitaiboboto.ph/api/v1/saln/saln-789" \\
  -H "X-API-Key: bkib_live_your_api_key"`,
      response: `{
  "data": {
    "id": "saln-789",
    "politicianId": "pol-123",
    "year": 2023,
    "totalAssets": 50000000,
    "totalLiabilities": 5000000,
    "netWorth": 45000000,
    "declaredSalary": 1200000,
    "anomalyDetected": false,
    "anomalyDetails": null,
    "realProperties": [
      {
        "id": "prop-1",
        "description": "Residential lot and house",
        "location": "Quezon City",
        "assessedValue": 15000000,
        "acquisitionDate": "2015-03-20",
        "acquisitionMode": "Purchase"
      }
    ],
    "personalProperties": [...],
    "investments": [...],
    "sources": [...]
  },
  "meta": {...}
}`,
    },
  },
];

export default function ApiDocsPage() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointDoc | null>(
    endpoints[0] ?? null
  );
  const [activeTab, setActiveTab] = useState<
    "overview" | "endpoints" | "authentication" | "errors"
  >("overview");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-900 py-8 text-white">
        <div className="container mx-auto px-4">
          <h1 className="mb-2 text-3xl font-bold">Bakit Kita Iboboto? API Documentation</h1>
          <p className="text-blue-200">
            Access Philippine politician data programmatically for research and journalism.
          </p>
        </div>
      </header>

      {/* Navigation */}
      <nav className="sticky top-0 z-10 border-b bg-white">
        <div className="container mx-auto px-4">
          <div className="flex space-x-8">
            {(["overview", "endpoints", "authentication", "errors"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 px-2 py-4 font-medium capitalize ${
                  activeTab === tab
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        {activeTab === "overview" && (
          <div className="max-w-4xl">
            <h2 className="mb-4 text-2xl font-bold">Overview</h2>
            <div className="mb-6 rounded-lg bg-white p-6 shadow">
              <p className="mb-4 text-gray-700">
                The Bakit Kita Iboboto? API provides programmatic access to comprehensive data about
                Philippine politicians, including their profiles, legislative work, election
                history, and financial disclosures (SALN).
              </p>
              <p className="mb-4 text-gray-700">
                This API is designed for researchers, journalists, and civic technology developers
                who want to build applications or conduct analyses using official government data.
              </p>
              <div className="mt-4 border-l-4 border-yellow-400 bg-yellow-50 p-4">
                <p className="text-yellow-800">
                  <strong>Attribution Required:</strong> When publishing data obtained through this
                  API, you must attribute the source as &quot;Bakit Kita Iboboto? - Data sourced
                  from official Philippine government records.&quot;
                </p>
              </div>
            </div>

            <h3 className="mb-3 text-xl font-bold">Base URL</h3>
            <div className="mb-6 rounded-lg bg-gray-800 p-4 font-mono text-green-400">
              https://api.bakitkitaiboboto.ph/api/v1
            </div>

            <h3 className="mb-3 text-xl font-bold">Quick Start</h3>
            <div className="rounded-lg bg-white p-6 shadow">
              <ol className="list-inside list-decimal space-y-3 text-gray-700">
                <li>
                  Register for an API key at{" "}
                  <a href="/api-keys" className="text-blue-600 hover:underline">
                    /api-keys
                  </a>
                </li>
                <li>
                  Include your API key in requests via the{" "}
                  <code className="rounded bg-gray-100 px-2 py-1">X-API-Key</code> header
                </li>
                <li>Make requests to the endpoints documented below</li>
                <li>Handle rate limits (1000 requests/hour by default)</li>
              </ol>
            </div>
          </div>
        )}

        {activeTab === "endpoints" && (
          <div className="flex gap-8">
            {/* Sidebar */}
            <div className="w-64 flex-shrink-0">
              <h3 className="mb-3 font-bold text-gray-700">Endpoints</h3>
              <nav className="space-y-1">
                {endpoints.map((endpoint) => (
                  <button
                    key={`${endpoint.method}-${endpoint.path}`}
                    onClick={() => setSelectedEndpoint(endpoint)}
                    className={`w-full rounded px-3 py-2 text-left text-sm ${
                      selectedEndpoint === endpoint
                        ? "bg-blue-100 text-blue-800"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    <span
                      className={`mr-2 font-mono text-xs ${
                        endpoint.method === "GET" ? "text-green-600" : "text-blue-600"
                      }`}
                    >
                      {endpoint.method}
                    </span>
                    <span className="font-mono text-xs">{endpoint.path}</span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Content */}
            <div className="flex-1">
              {selectedEndpoint && (
                <div className="rounded-lg bg-white shadow">
                  <div className="border-b p-6">
                    <div className="mb-2 flex items-center gap-3">
                      <span
                        className={`rounded px-2 py-1 text-sm font-bold ${
                          selectedEndpoint.method === "GET"
                            ? "bg-green-100 text-green-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {selectedEndpoint.method}
                      </span>
                      <code className="font-mono text-lg">{selectedEndpoint.path}</code>
                    </div>
                    <p className="text-gray-600">{selectedEndpoint.description}</p>
                  </div>

                  {selectedEndpoint.parameters && selectedEndpoint.parameters.length > 0 && (
                    <div className="border-b p-6">
                      <h4 className="mb-3 font-bold">Parameters</h4>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500">
                            <th className="pb-2">Name</th>
                            <th className="pb-2">Type</th>
                            <th className="pb-2">Required</th>
                            <th className="pb-2">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedEndpoint.parameters.map((param) => (
                            <tr key={param.name} className="border-t">
                              <td className="py-2 font-mono text-blue-600">{param.name}</td>
                              <td className="py-2 text-gray-500">{param.type}</td>
                              <td className="py-2">
                                {param.required ? (
                                  <span className="text-red-600">Yes</span>
                                ) : (
                                  <span className="text-gray-400">No</span>
                                )}
                              </td>
                              <td className="py-2 text-gray-600">{param.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="p-6">
                    <h4 className="mb-3 font-bold">Example</h4>
                    <div className="mb-4">
                      <p className="mb-2 text-sm text-gray-500">Request</p>
                      <pre className="overflow-x-auto rounded-lg bg-gray-800 p-4 text-sm text-green-400">
                        {selectedEndpoint.example.request}
                      </pre>
                    </div>
                    <div>
                      <p className="mb-2 text-sm text-gray-500">Response</p>
                      <pre className="overflow-x-auto rounded-lg bg-gray-800 p-4 text-sm text-green-400">
                        {selectedEndpoint.example.response}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "authentication" && (
          <div className="max-w-4xl">
            <h2 className="mb-4 text-2xl font-bold">Authentication</h2>
            <div className="mb-6 rounded-lg bg-white p-6 shadow">
              <p className="mb-4 text-gray-700">
                All API requests require authentication using an API key. You can obtain an API key
                by registering on our platform.
              </p>

              <h3 className="mb-3 text-lg font-bold">Providing Your API Key</h3>
              <p className="mb-4 text-gray-700">
                You can provide your API key in one of three ways:
              </p>

              <div className="space-y-4">
                <div className="rounded bg-gray-50 p-4">
                  <h4 className="mb-2 font-bold">1. X-API-Key Header (Recommended)</h4>
                  <pre className="rounded bg-gray-800 p-3 text-sm text-green-400">
                    {`curl -H "X-API-Key: bkib_live_your_api_key" \\
  https://api.bakitkitaiboboto.ph/api/v1/politicians`}
                  </pre>
                </div>

                <div className="rounded bg-gray-50 p-4">
                  <h4 className="mb-2 font-bold">2. Authorization Bearer Header</h4>
                  <pre className="rounded bg-gray-800 p-3 text-sm text-green-400">
                    {`curl -H "Authorization: Bearer bkib_live_your_api_key" \\
  https://api.bakitkitaiboboto.ph/api/v1/politicians`}
                  </pre>
                </div>

                <div className="rounded bg-gray-50 p-4">
                  <h4 className="mb-2 font-bold">3. Query Parameter</h4>
                  <pre className="rounded bg-gray-800 p-3 text-sm text-green-400">
                    {`curl "https://api.bakitkitaiboboto.ph/api/v1/politicians?api_key=bkib_live_your_api_key"`}
                  </pre>
                </div>
              </div>
            </div>

            <h2 className="mb-4 text-2xl font-bold">Rate Limiting</h2>
            <div className="rounded-lg bg-white p-6 shadow">
              <p className="mb-4 text-gray-700">
                API requests are rate limited to prevent abuse. The default limit is 1000 requests
                per hour.
              </p>

              <h3 className="mb-3 text-lg font-bold">Rate Limit Headers</h3>
              <p className="mb-4 text-gray-700">
                Every API response includes headers indicating your rate limit status:
              </p>

              <table className="mb-4 w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2">Header</th>
                    <th className="pb-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 font-mono">X-RateLimit-Limit</td>
                    <td className="py-2">Maximum requests allowed per hour</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-mono">X-RateLimit-Remaining</td>
                    <td className="py-2">Requests remaining in current window</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-mono">X-RateLimit-Reset</td>
                    <td className="py-2">Unix timestamp when the rate limit resets</td>
                  </tr>
                </tbody>
              </table>

              <div className="border-l-4 border-red-400 bg-red-50 p-4">
                <p className="text-red-800">
                  <strong>429 Too Many Requests:</strong> If you exceed the rate limit, you will
                  receive a 429 status code. Wait until the reset time before making more requests.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "errors" && (
          <div className="max-w-4xl">
            <h2 className="mb-4 text-2xl font-bold">Error Handling</h2>
            <div className="mb-6 rounded-lg bg-white p-6 shadow">
              <p className="mb-4 text-gray-700">
                The API uses standard HTTP status codes and returns errors in a consistent JSON
                format.
              </p>

              <h3 className="mb-3 text-lg font-bold">Error Response Format</h3>
              <pre className="mb-6 rounded-lg bg-gray-800 p-4 text-sm text-green-400">
                {`{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}`}
              </pre>

              <h3 className="mb-3 text-lg font-bold">Error Codes</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Code</th>
                    <th className="pb-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2">400</td>
                    <td className="py-2 font-mono">BAD_REQUEST</td>
                    <td className="py-2">Invalid request parameters</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">401</td>
                    <td className="py-2 font-mono">UNAUTHORIZED</td>
                    <td className="py-2">Missing or invalid API key</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">403</td>
                    <td className="py-2 font-mono">FORBIDDEN</td>
                    <td className="py-2">API key lacks required permissions</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">404</td>
                    <td className="py-2 font-mono">NOT_FOUND</td>
                    <td className="py-2">Requested resource not found</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">429</td>
                    <td className="py-2 font-mono">RATE_LIMIT_EXCEEDED</td>
                    <td className="py-2">Too many requests</td>
                  </tr>
                  <tr>
                    <td className="py-2">500</td>
                    <td className="py-2 font-mono">INTERNAL_ERROR</td>
                    <td className="py-2">Server error</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2 className="mb-4 text-2xl font-bold">Best Practices</h2>
            <div className="rounded-lg bg-white p-6 shadow">
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="mr-2 text-green-500">✓</span>
                  <span>Cache responses when possible to reduce API calls</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-green-500">✓</span>
                  <span>Use pagination to fetch large datasets efficiently</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-green-500">✓</span>
                  <span>Monitor rate limit headers to avoid hitting limits</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-green-500">✓</span>
                  <span>Implement exponential backoff for retries</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-green-500">✓</span>
                  <span>Always attribute data sources in your publications</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 bg-gray-800 py-8 text-gray-400">
        <div className="container mx-auto px-4 text-center">
          <p>© 2024 Bakit Kita Iboboto? All rights reserved.</p>
          <p className="mt-2 text-sm">Data sourced from official Philippine government records.</p>
        </div>
      </footer>
    </div>
  );
}
