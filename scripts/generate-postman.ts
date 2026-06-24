/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-require-imports */
/**
 * Generates a Postman Collection from the Swagger/OpenAPI JSON.
 *
 * Usage:
 *   1. Start the server: yarn start:dev
 *   2. Run: yarn postman
 *
 * Or run standalone (auto-starts server, fetches swagger, stops server):
 *   yarn postman:auto
 */

import * as fs from 'fs';
import * as path from 'path';

const Converter = require('openapi-to-postmanv2');

const API_URL = process.env.API_URL || 'http://127.0.0.1:3001';
const SWAGGER_PATH = '/api/docs-json';
const OUTPUT_DIR = path.join(__dirname, '..', 'postman');
const COLLECTION_FILE = path.join(
  OUTPUT_DIR,
  'Yuusell_API.postman_collection.json',
);
const ENVIRONMENT_FILE = path.join(
  OUTPUT_DIR,
  'Yuusell_Dev.postman_environment.json',
);

async function fetchSwaggerJson(): Promise<any> {
  const url = `${API_URL}${SWAGGER_PATH}`;
  console.log(`📡 Fetching Swagger JSON from: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Swagger JSON: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

function convertToPostman(swaggerJson: any): Promise<any> {
  return new Promise((resolve, reject) => {
    Converter.convert(
      { type: 'json', data: swaggerJson },
      {
        folderStrategy: 'Tags',
        requestParametersResolution: 'Example',
        exampleParametersResolution: 'Example',
        optimizeConversion: false,
        stackLimit: 50,
      },
      (err: any, result: any) => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
          return;
        }
        if (!result.result) {
          reject(new Error(`Conversion failed: ${result.reason}`));
          return;
        }
        resolve(result.output[0].data);
      },
    );
  });
}

function addPostmanScripts(collection: any): any {
  // Collection-level bearer auth — inherited by every request unless overridden.
  // The actual token is resolved from the {{accessToken}} environment variable.
  collection.auth = {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }],
  };

  // Collection-level pre-request script: ensures the Authorization header is
  // present for every request (skipped automatically when no token is set).
  collection.event = [
    {
      listen: 'prerequest',
      script: {
        type: 'text/javascript',
        exec: [
          '// Centralized auth header injection (collection level).',
          "const token = pm.environment.get('accessToken');",
          'if (token) {',
          '    pm.request.headers.upsert({',
          "        key: 'Authorization',",
          "        value: 'Bearer ' + token,",
          '    });',
          '}',
        ],
      },
    },
  ];

  // Walk through items and add auto-token scripts
  function processItems(items: any[]) {
    for (const item of items) {
      if (item.item) {
        processItems(item.item);
        continue;
      }

      if (!item.request) continue;

      // Replace base URL with variable
      if (item.request.url) {
        const url = item.request.url;
        if (typeof url === 'object' && url.raw) {
          url.raw = url.raw.replace(/http:\/\/[^/]+/, '{{baseUrl}}');
          if (url.host) {
            url.host = ['{{baseUrl}}'];
          }
        }
      }

      const name = (item.name || '').toLowerCase();
      const isPublic =
        name.includes('register') ||
        name.includes('login') ||
        name.includes('refresh') ||
        name.includes('forgot') ||
        name.includes('reset-password');

      // Public endpoints opt out of the inherited collection-level bearer auth.
      if (isPublic) {
        item.request.auth = { type: 'noauth' };
      } else {
        // Protected endpoints inherit auth from the collection — remove any
        // per-request auth so they fall back to the collection default.
        delete item.request.auth;
      }

      // Add auto-save token scripts for login and register
      if (name.includes('login') || name.includes('register')) {
        item.event = [
          {
            listen: 'test',
            script: {
              type: 'text/javascript',
              exec: [
                'const response = pm.response.json();',
                'if (response.data && response.data.tokens) {',
                '    pm.environment.set("accessToken", response.data.tokens.accessToken);',
                '    pm.environment.set("refreshToken", response.data.tokens.refreshToken);',
                '    console.log("✅ Tokens saved to environment variables");',
                '}',
                '',
                'pm.test("Status code is successful", function () {',
                '    pm.response.to.have.status(200) || pm.response.to.have.status(201);',
                '});',
              ],
            },
          },
        ];
      }

      // Add auto-save for refresh
      if (name.includes('refresh')) {
        item.event = [
          {
            listen: 'test',
            script: {
              type: 'text/javascript',
              exec: [
                'const response = pm.response.json();',
                'if (response.data) {',
                '    pm.environment.set("accessToken", response.data.accessToken);',
                '    pm.environment.set("refreshToken", response.data.refreshToken);',
                '    console.log("✅ Tokens refreshed and saved");',
                '}',
              ],
            },
          },
        ];
      }
    }
  }

  processItems(collection.item || []);
  return collection;
}

function generateEnvironment(): any {
  return {
    id: 'yuusell-dev-env',
    name: 'Yuusell Dev',
    values: [
      {
        key: 'baseUrl',
        value: 'http://localhost:3001',
        enabled: true,
        type: 'default',
      },
      { key: 'accessToken', value: '', enabled: true, type: 'secret' },
      { key: 'refreshToken', value: '', enabled: true, type: 'secret' },
      {
        key: 'testEmail',
        value: 'testuser@example.com',
        enabled: true,
        type: 'default',
      },
      {
        key: 'testPassword',
        value: 'TestPass@123',
        enabled: true,
        type: 'default',
      },
      {
        key: 'adminEmail',
        value: 'admin@yuusell.com',
        enabled: true,
        type: 'default',
      },
      {
        key: 'adminPassword',
        value: 'Admin@123456',
        enabled: true,
        type: 'default',
      },
    ],
    _postman_variable_scope: 'environment',
  };
}

async function main() {
  try {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Fetch Swagger JSON
    const swaggerJson = await fetchSwaggerJson();
    console.log('✅ Swagger JSON fetched successfully');

    // Convert to Postman
    let collection = await convertToPostman(swaggerJson);
    console.log('✅ Converted to Postman collection');

    // Add scripts and variables
    collection = addPostmanScripts(collection);
    console.log('✅ Added auto-token scripts');

    // Save collection
    fs.writeFileSync(COLLECTION_FILE, JSON.stringify(collection, null, 2));
    console.log(`📁 Collection saved: ${COLLECTION_FILE}`);

    // Save environment
    const environment = generateEnvironment();
    fs.writeFileSync(ENVIRONMENT_FILE, JSON.stringify(environment, null, 2));
    console.log(`📁 Environment saved: ${ENVIRONMENT_FILE}`);

    console.log('\n🎉 Postman collection generated successfully!');
    console.log('   Import both files into Postman:');
    console.log(`   - Collection: postman/Yuusell_API.postman_collection.json`);
    console.log(
      `   - Environment: postman/Yuusell_Dev.postman_environment.json`,
    );
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
